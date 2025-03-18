import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Door } from './entities/door.entity';
import { IDoor } from './interfaces/door.interface';
import { RedisService } from '../../redis/redis.service';
import { CreateDoorDto, UpdateDoorDto } from './dto';
import { Category } from '../../categories/entities/category.entity';

@Injectable()
export class FarnitureService implements OnModuleInit {
  private readonly logger = new Logger(FarnitureService.name);
  private readonly baseUrl = 'https://www.farniture.ru/catalog/vkhodnye';
  private readonly categories = [
    'reks',
    'asd',
    'diva',
    'sudar',
    'ratibor',
    'zavodskie',
    'leks',
    'termo',
    'intekron',
    'labirint',
    'bunker'
  ];
  private redisEnabled = true;

  constructor(
    @InjectRepository(Door)
    private readonly doorRepository: Repository<Door>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private schedulerRegistry: SchedulerRegistry,
    private readonly redisService: RedisService
  ) {
    this.logger.log('[Constructor] FarnitureService initialized');
    this.logger.log('[Constructor] Checking database connection...');
    this.doorRepository.count()
      .then(count => {
        this.logger.log(`[Constructor] Database connection successful, found ${count} doors`);
      })
      .catch(error => {
        this.logger.error(`[Constructor] Database connection error: ${error.message}`);
        this.logger.error(`[Constructor] Full error stack: ${error.stack}`);
      });
      
    // Проверяем, включен ли Redis
    this.redisEnabled = process.env.REDIS_ENABLED !== 'false';
    if (!this.redisEnabled) {
      this.logger.warn('[Constructor] Redis is disabled by environment variable REDIS_ENABLED=false');
    }
  }

  async onModuleInit() {
    try {
      this.logger.log('=== Starting FarnitureService initialization ===');
      
      // Проверяем структуру таблицы
      try {
        const tableInfo = await this.doorRepository.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'doors\'');
        this.logger.log(`[Init] Table structure: ${JSON.stringify(tableInfo)}`);
      } catch (error) {
        this.logger.error(`[Init] Error checking table structure: ${error.message}`);
      }
      
      // Проверяем наличие дверей в базе данных
      const doorsCount = await this.doorRepository.count();
      this.logger.log(`[Init] Found ${doorsCount} doors in database`);

      // Проверяем наличие дверей в Redis, только если Redis включен
      let redisKeys: string[] = [];
      if (this.redisEnabled && this.redisService['client']) {
        try {
          redisKeys = await this.redisService['client'].keys('door:*');
          this.logger.log(`[Init] Found ${redisKeys.length} doors in Redis`);
        } catch (error) {
          this.logger.error(`[Init] Error accessing Redis: ${error.message}`);
          this.redisEnabled = false;
        }
      } else {
        this.logger.log('[Init] Redis is disabled or not available, skipping Redis checks');
      }

      let shouldStartParser = false;

      if (doorsCount === 0 && this.redisEnabled && redisKeys.length > 0) {
        // Если база пуста, но есть данные в Redis - восстанавливаем из Redis
        this.logger.log('[Init] Database is empty but Redis has data, restoring from Redis...');
        await this.restoreFromRedis();
        
        // Проверяем успешность восстановления
        const restoredCount = await this.doorRepository.count();
        if (restoredCount === 0) {
          this.logger.warn('[Init] Failed to restore from Redis, will start parser');
          shouldStartParser = true;
        }
      } else if (doorsCount === 0) {
        // Если нет данных в базе или Redis отключен
        shouldStartParser = true;
      }

      if (shouldStartParser) {
        this.logger.log('[Init] No doors found in database or Redis is disabled, starting parser');
        await this.parseAndSaveDoors();
      } else {
        this.logger.log(`[Init] Skipping parsing - found ${doorsCount} doors in database`);
      }

      // Устанавливаем ежедневную проверку
      const interval = setInterval(async () => {
        const dbCount = await this.doorRepository.count();
        let redisCount = 0;
        
        if (this.redisEnabled && this.redisService['client']) {
          try {
            redisCount = (await this.redisService['client'].keys('door:*')).length;
          } catch (error) {
            this.logger.error(`[Daily] Error accessing Redis: ${error.message}`);
          }
        }
        
        if (dbCount === 0 && this.redisEnabled && redisCount > 0) {
          this.logger.log('[Daily] Database is empty but Redis has data, restoring from Redis...');
          await this.restoreFromRedis();
        } else if (dbCount === 0) {
          this.logger.log('[Daily] No doors found, starting parser');
          await this.parseAndSaveDoors();
        } else {
          this.logger.log(`[Daily] Skipping parsing - found ${dbCount} doors in database`);
        }
      }, 24 * 60 * 60 * 1000);

      this.schedulerRegistry.addInterval('daily-parsing', interval);
    } catch (error) {
      this.logger.error('[Init] Error during initialization:', error);
      throw error;
    }
  }

  async parseAndSaveDoors() {
    try {
      // Очищаем память перед началом парсинга
      if (global.gc) {
        global.gc();
      }

      const dbCount = await this.doorRepository.count();
      let redisCount = 0;
      
      if (this.redisEnabled && this.redisService['client']) {
        try {
          redisCount = (await this.redisService['client'].keys('door:*')).length;
        } catch (error) {
          this.logger.error(`[Parser] Error accessing Redis: ${error.message}`);
        }
      }

      if (dbCount > 0 || (this.redisEnabled && redisCount > 0)) {
        this.logger.warn(`[Parser] Skipping parse - found ${dbCount} doors in database and ${redisCount} in Redis`);
        return;
      }

      this.logger.log('[Parser] Starting doors parsing...');
      
      const categoriesToParse = this.categories;
      this.logger.log(`[Parser] Will parse all ${categoriesToParse.length} categories: ${categoriesToParse.join(', ')}`);
      
      let totalParsedDoors = 0;
      let totalSavedDoors = 0;
      
      // Получаем все категории из базы данных
      const categories = await this.categoryRepository.find();
      const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
      
      // Обрабатываем категории последовательно с большими интервалами
      for (const category of categoriesToParse) {
        try {
          this.logger.log(`[Parser] Starting to parse category: ${category}`);
          
          // Увеличиваем интервал между категориями
          if (totalParsedDoors > 0) {
            this.logger.log(`[Parser] Waiting 30 seconds before parsing next category...`);
            await this.delay(30000);
            
            // Принудительная очистка памяти между категориями
            if (global.gc) {
              global.gc();
            }
          }
          
          const doors = await this.parseCategory(category);
          
          // Сразу сохраняем двери из этой категории и очищаем память
          if (doors.length > 0) {
            this.logger.log(`[Parser] Saving ${doors.length} doors from category ${category}`);
            const savedCount = await this.saveDoors(doors);
            totalParsedDoors += doors.length;
            totalSavedDoors += savedCount;
            
            // Очищаем массив дверей после сохранения
            doors.length = 0;
            
            // Принудительная очистка памяти после сохранения
            if (global.gc) {
              global.gc();
            }
            
            this.logger.log(`[Parser] Progress: parsed ${totalParsedDoors} doors, saved ${totalSavedDoors} doors`);
          }
        } catch (error) {
          this.logger.error(`[Parser] Error parsing category ${category}: ${error.message}`);
          continue;
        }
      }
      
      return { 
        totalDoors: totalParsedDoors,
        savedDoors: totalSavedDoors,
        savedInDb: await this.doorRepository.count(),
        savedInRedis: this.redisEnabled ? (await this.redisService['client'].keys('door:*')).length : 0
      };
    } catch (error) {
      this.logger.error('[Parser] Error during parsing:', error);
      throw error;
    }
  }

  private async saveDoors(doors: IDoor[]): Promise<number> {
    let savedCount = 0;
    
    // Разбиваем двери на пакеты для снижения нагрузки на БД
    const batchSize = 10;
    const batches: IDoor[][] = [];
    
    for (let i = 0; i < doors.length; i += batchSize) {
      batches.push(doors.slice(i, i + batchSize));
    }
    
    this.logger.log(`[Parser] Split ${doors.length} doors into ${batches.length} batches of ${batchSize}`);
    
    // Обрабатываем каждый пакет
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      this.logger.log(`[Parser] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} doors)`);
      
      // Добавляем задержку между пакетами
      if (batchIndex > 0) {
        await this.delay(2000);
      }
      
      // Обрабатываем каждую дверь в пакете
      for (const doorData of batch) {
        try {
          const externalId = this.generateExternalId(doorData);
          
          // Проверяем обязательные поля
          if (!doorData.title || !doorData.price || !doorData.categoryId || !doorData.url) {
            this.logger.error(`[Parser] Missing required fields for door: ${JSON.stringify(doorData)}`);
            continue;
          }

          // Подготавливаем данные для сохранения
          const doorToSave = {
            ...doorData,
            externalId,
            imageUrls: doorData.imageUrls || [],
            inStock: doorData.inStock || false,
            description: doorData.description || '',
            specifications: doorData.specifications || {},
            category: { id: doorData.categoryId }
          };

          // Сохраняем в базу данных
          const savedDoor = await this.doorRepository.save(doorToSave);
          
          if (!savedDoor || !savedDoor.id) {
            this.logger.error(`[Parser] Failed to save door ${doorData.title} to database`);
            continue;
          }

          savedCount++;
          this.logger.log(`[Parser] Successfully saved door to DB: ${doorData.title} (${externalId})`);
          
          // Сохраняем в Redis, если он включен
          if (this.redisEnabled) {
            try {
              const doorHash = this.getDoorHashData(doorData);
              const redisKey = `door:${externalId}`;
              await this.redisService.set(redisKey, JSON.stringify(doorData));
              this.logger.debug(`[Parser] Saved door to Redis: ${redisKey}`);
            } catch (error) {
              this.logger.error(`[Parser] Error saving door to Redis: ${error.message}`);
            }
          }
        } catch (error) {
          this.logger.error(`[Parser] Error saving door: ${error.message}`);
          continue;
        }
      }
      
      // Логируем прогресс после каждого пакета
      this.logger.log(`[Parser] Batch ${batchIndex + 1}/${batches.length} completed. Total saved: ${savedCount}/${doors.length}`);
    }
    
    return savedCount;
  }

  private generateExternalId(door: IDoor): string {
    // Используем UUID v4 для генерации уникального идентификатора
    return uuidv4();
  }

  private getDoorHashData(door: IDoor) {
    return {
      title: door.title,
      categoryId: door.categoryId,
      url: door.url,
      price: door.price,
      oldPrice: door.oldPrice,
      inStock: door.inStock,
      description: door.description,
      specifications: door.specifications,
      imageUrls: door.imageUrls
    };
  }

  private normalizeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private async parseCategory(category: string): Promise<IDoor[]> {
    const url = `${this.baseUrl}/${category}/`;
    const doors: IDoor[] = [];

    try {
      this.logger.log(`Starting to parse category: ${category}`);
      
      // Получаем первую страницу категории
      const mainPageHtml = await this.fetchPage(url);
      const $mainPage = cheerio.load(mainPageHtml);
      
      // Получаем все ссылки на подкатегории
      const subcategoryLinks = new Set<string>();
      $mainPage('a').each((_, el) => {
        const href = $mainPage(el).attr('href');
        if (href && 
            href.includes(`/catalog/vkhodnye/${category}/`) && 
            !href.includes('?') && 
            !href.includes('#') && 
            !href.includes('javascript:')) {
          subcategoryLinks.add(href);
        }
      });

      const uniqueSubcategoryLinks = Array.from(subcategoryLinks);
      this.logger.log(`Found ${uniqueSubcategoryLinks.length} unique subcategories in ${category}`);

      // Парсим двери на главной странице категории
      await this.parseAllPages(url, category, doors);

      // Очищаем память
      $mainPage.root().empty();
      
      // Парсим каждую подкатегорию
      for (const subcategoryUrl of uniqueSubcategoryLinks) {
        try {
          this.logger.log(`Parsing subcategory: ${subcategoryUrl}`);
          await this.delay(10000);
          
          const fullUrl = `https://www.farniture.ru${subcategoryUrl}`;
          await this.parseAllPages(fullUrl, category, doors);

        } catch (error) {
          this.logger.error(`Error parsing subcategory ${subcategoryUrl}: ${error.message}`);
          continue;
        }
      }

    } catch (error) {
      this.logger.error(`Error fetching category ${category}: ${error.message}`);
      this.logger.error(error.stack);
    }

    return doors;
  }

  private async parseAllPages(baseUrl: string, category: string, doors: IDoor[]): Promise<void> {
    let currentPage = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      try {
        const pageUrl = currentPage === 1 ? baseUrl : `${baseUrl}?PAGEN_1=${currentPage}`;
        this.logger.log(`Parsing page ${currentPage} at ${pageUrl}`);
        
        const html = await this.fetchPage(pageUrl);
        const $ = cheerio.load(html);

        // Парсим двери на текущей странице
        await this.parseDoors($, category, doors);

        // Проверяем наличие следующей страницы
        const nextPageLink = $('.module-pagination .nums .next').first();
        hasNextPage = nextPageLink.length > 0;

        // Очищаем память
        $.root().empty();

        if (hasNextPage) {
          currentPage++;
          // Увеличенная задержка между страницами
          await this.delay(15000);
        }

        if (global.gc) {
          global.gc();
        }
      } catch (error) {
        this.logger.error(`Error parsing page ${currentPage}: ${error.message}`);
        break;
      }
    }
  }

  private async fetchPage(url: string): Promise<string> {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
      },
      timeout: 30000,
      maxContentLength: 10 * 1024 * 1024
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Удаляем ненужные элементы для экономии памяти
    $('script').remove();
    $('style').remove();
    $('link').remove();
    $('noscript').remove();
    $('[data-skip-moving]').remove();
    $('#bxdynamic_basketitems-component-block_start').remove();
    $('#bxdynamic_basketitems-component-block_end').remove();
    $('.cd-modal-bg').remove();
    $('.burger-dropdown-menu').remove();
    $('.mega_fixed_menu').remove();

    return $.html();
  }

  private async parseDoors($: cheerio.CheerioAPI, category: string, doors: IDoor[]): Promise<void> {
    // Расширяем список селекторов для поиска карточек дверей
    const doorSelectors = [
      '.catalog_item_wrapp.catalog_item.item_wrap',
      '.catalog_block .catalog_item',
      '.product-item-container',
      '.js-product-item',
      '.item.product-item',
      '.catalog_block .item_block',
      '.catalog_block .item',
      '[data-entity="item"]'
    ];

    let doorCards;
    for (const selector of doorSelectors) {
      const cards = $(selector);
      if (cards.length > 0) {
        doorCards = cards;
        break;
      }
    }

    if (!doorCards || doorCards.length === 0) {
      this.logger.warn('No door cards found on the page');
      return;
    }

    const doorCardsArray = doorCards.toArray();
    const batchSize = 5;
    
    for (let i = 0; i < doorCardsArray.length; i += batchSize) {
      const batch = doorCardsArray.slice(i, i + batchSize);
      
      if (i > 0) {
        await this.delay(5000);
      }
      
      for (const card of batch) {
        try {
          const $card = $(card);
          
          // Расширяем селекторы для поиска заголовка
          const titleSelectors = [
            '.item-title a span',
            '.item-title span',
            '.product-item-title a',
            '.product_title a',
            'h4 a',
            '[data-entity="title"] span'
          ];

          let title = '';
          for (const selector of titleSelectors) {
            title = $card.find(selector).text().trim();
            if (title) break;
          }

          // Расширяем селекторы для поиска цены
          const priceSelectors = [
            '.price.font-bold.font_mxs',
            '.price_value',
            '.product-item-price-current',
            '.price',
            '[data-entity="price"]'
          ];

          let priceText = '';
          for (const selector of priceSelectors) {
            const priceElement = $card.find(selector);
            priceText = priceElement.attr('data-value') || priceElement.text().trim();
            if (priceText) break;
          }

          // Очищаем цену от нечисловых символов
          priceText = priceText.replace(/[^\d]/g, '');

          if (!title || !priceText) {
            this.logger.warn(`Skipping door card - missing title or price`);
            continue;
          }

          const imageUrls: string[] = [];
          const imageSelectors = [
            '.section-gallery-wrapper__item img.img-responsive',
            '.image_wrapper_block img.img-responsive',
            '.product-item-image-wrapper img',
            '.image img',
            '[data-entity="image"] img'
          ];

          for (const selector of imageSelectors) {
            $card.find(selector).each((_, img) => {
              const imgUrl = $(img).attr('data-src') || $(img).attr('src');
              if (imgUrl && !imgUrl.includes('double_ring.svg')) {
                const fullUrl = imgUrl.startsWith('http') ? imgUrl : `https://www.farniture.ru${imgUrl}`;
                if (!imageUrls.includes(fullUrl)) {
                  imageUrls.push(fullUrl.replace(/";$/, ''));
                }
              }
            });
            if (imageUrls.length > 0) break;
          }

          const productUrl = $card.find('a[href*="/catalog/"]').attr('href');
          if (!productUrl) {
            this.logger.warn(`Skipping door card - no product URL found`);
            continue;
          }

          const stockBlock = $card.find('.item-stock, [data-entity="stock"]');
          const inStock = stockBlock.length > 0 && 
                         (stockBlock.find('.value').text().includes('Есть в наличии') || 
                          stockBlock.text().includes('В наличии'));

          const door: IDoor = {
            title,
            price: parseInt(priceText) || 0,
            categoryId: await this.getCategoryId(category),
            imageUrls,
            inStock,
            url: productUrl.startsWith('http') ? productUrl : `https://www.farniture.ru${productUrl}`,
            features: [],
            installation: {}
          };

          try {
            await this.delay(3000);
            const details = await this.parseProductDetails(door.url);
            Object.assign(door, details);
          } catch (error) {
            this.logger.warn(`Error parsing details for ${title}: ${error.message}`);
          }

          doors.push(door);
          this.logger.debug(`Successfully parsed door: ${title}`);
        } catch (error) {
          this.logger.error(`Error parsing door card: ${error.message}`);
          continue;
        }
      }

      if (global.gc) {
        global.gc();
      }
    }
  }

  private async getCategoryId(categoryName: string): Promise<number> {
    const category = await this.categoryRepository.findOne({
      where: { name: categoryName }
    });
    
    if (!category) {
      // Если категория не найдена, создаем новую
      const newCategory = await this.categoryRepository.save({
        name: categoryName,
        description: `Категория дверей ${categoryName}`
      });
      return newCategory.id;
    }
    
    return category.id;
  }

  private async parseProductDetails(url: string): Promise<Partial<IDoor>> {
    try {
      const response = await axios.get(url, {
        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const html = response.data;
      
      // Проверяем, что ответ не является HTML-страницей с ошибкой
      if (typeof html !== 'string' || html.includes('<!DOCTYPE html>') && !html.includes('product-detail-gallery')) {
        throw new Error('Invalid response format - received error page');
      }

      // Загружаем HTML и удаляем ненужные элементы
      const $ = cheerio.load(html);
      
      // Удаляем все скрипты, стили и другие ненужные элементы
      $('script').remove();
      $('style').remove();
      $('link').remove();
      $('meta').remove();
      $('.basket_props_block').remove();
      $('.product-action').remove();
      $('.product-info-headnote').remove();
      $('.js-info-block').remove();
      $('.product-chars').remove();
      $('.navigation-button-next').remove();
      $('.navigation-button-prev').remove();
      $('.product-detail-gallery__slider.thmb').remove();
      $('.detail-gallery-big').remove();

      const details: Partial<IDoor> & { 
        specifications: Record<string, string>;
        imageUrls: string[];
        thumbnailUrls: string[];
      } = {
        description: 'Описание отсутствует',
        specifications: {},
        dimensions: {},
        materials: {
          frame: 'Не указан',
          coating: 'Не указано',
          insulation: 'Не указан'
        },
        features: [],
        manufacturer: 'Не указан',
        warranty: 'Не указана',
        installation: {
          opening: 'universal',
          type: 'Стандартная'
        },
        equipment: [],
        imageUrls: [],
        thumbnailUrls: []
      };

      // Парсим основную информацию
      const title = $('#pagetitle').text().trim();
      if (!title) {
        throw new Error('Could not find product title');
      }
      details.title = title;
      details.url = url;

      // Парсим цены
      const priceBlock = $('.cost.prices.detail');
      if (priceBlock.length) {
        const priceText = priceBlock.find('.price_value').first().text().trim();
        if (priceText) {
          details.price = parseFloat(priceText.replace(/\s+/g, '')) || 0;
        }
        
        const oldPriceText = priceBlock.find('.price.discount .price_value').text().trim();
        if (oldPriceText) {
          details.oldPrice = parseFloat(oldPriceText.replace(/\s+/g, ''));
        }
        
        details.priceUnit = priceBlock.find('.price_measure').text().trim() || 'шт';
      }

      // Парсим акционную информацию
      const saleBlock = $('.view_sale_block');
      if (saleBlock.length > 0) {
        const endDate = saleBlock.find('.active_to').text().trim();
        const quantityText = saleBlock.find('.quantity_block .value').text().trim();
        if (endDate || quantityText) {
          details.sale = {
            endDate: endDate || '',
            remainingQuantity: parseInt(quantityText) || 0
          };
        }
      }

      // Парсим наличие
      const stockBlock = $('.item-stock');
      details.inStock = stockBlock.length > 0 && stockBlock.find('.value').text().includes('Есть в наличии');

      // Парсим описание
      const description = $('.detail-text-wrap').text().trim();
      details.description = description || 'Описание отсутствует';

      // Парсим характеристики
      $('.props_list tr').each((_, row) => {
        const key = $(row).find('.char_name').text().trim().toLowerCase();
        const value = $(row).find('.char_value').text().trim();

        if (!key || !value) return;

        details.specifications[key] = value;

        // Обработка специфических характеристик
        if (key.includes('количество замков')) {
          const lockCount = parseInt(value);
          if (!isNaN(lockCount)) {
            details.lockCount = lockCount;
          }
        } else if (key.includes('толщина металла')) {
          const thickness = parseFloat(value);
          if (!isNaN(thickness)) {
            details.metalThickness = thickness;
          }
        } else if (key.includes('толщина полотна')) {
          const doorThickness = parseInt(value);
          if (!isNaN(doorThickness)) {
            details.doorThickness = doorThickness;
          }
        } else if (key.includes('наружная отделка')) {
          details.exteriorFinish = value;
        } else if (key.includes('внутренняя отделка')) {
          details.interiorFinish = value;
        } else if (key.includes('цвет изнутри')) {
          details.interiorColor = value;
        } else if (key.includes('цвет снаружи')) {
          details.exteriorColor = value;
        } else if (key.includes('размеры')) {
          details.sizes = value.split(',').map(size => size.trim()).filter(Boolean);
        } else if (key.includes('страна')) {
          details.country = value;
        }
      });

      // Парсим изображения
      const mainImage = $('.product-detail-gallery__picture').attr('src');
      if (mainImage) {
        const normalizedUrl = this.normalizeImageUrl(mainImage);
        if (normalizedUrl) {
          details.imageUrls.push(normalizedUrl);
        }
      }

      // Дополнительные изображения
      $('.product-detail-gallery__link').each((_, element) => {
        const imgUrl = $(element).attr('href');
        const thumbUrl = $(element).attr('data-thumb');
        
        if (imgUrl) {
          const normalizedImgUrl = this.normalizeImageUrl(imgUrl);
          if (normalizedImgUrl && !details.imageUrls.includes(normalizedImgUrl)) {
            details.imageUrls.push(normalizedImgUrl);
          }
        }
        
        if (thumbUrl) {
          const normalizedThumbUrl = this.normalizeImageUrl(thumbUrl);
          if (normalizedThumbUrl && !details.thumbnailUrls.includes(normalizedThumbUrl)) {
            details.thumbnailUrls.push(normalizedThumbUrl);
          }
        }
      });

      // Парсим информацию о бренде
      const brandBlock = $('.brand');
      if (brandBlock.length > 0) {
        const brandName = brandBlock.find('meta[itemprop="name"]').attr('content');
        const brandLogo = brandBlock.find('img').attr('src');
        const brandUrl = brandBlock.find('a').attr('href');
        
        if (brandName || brandLogo || brandUrl) {
          details.brand = {
            name: brandName || 'Не указан',
            logo: brandLogo ? this.normalizeImageUrl(brandLogo) : '',
            url: brandUrl || ''
          };
        }
      }

      // Парсим рейтинг и отзывы
      const ratingBlock = $('.rating');
      if (ratingBlock.length > 0) {
        const ratingValue = parseFloat(ratingBlock.find('meta[itemprop="ratingValue"]').attr('content') || '0');
        const reviewCount = parseInt(ratingBlock.find('meta[itemprop="reviewCount"]').attr('content') || '0');
        
        if (!isNaN(ratingValue) || !isNaN(reviewCount)) {
          details.rating = {
            value: ratingValue,
            count: reviewCount
          };
        }
      }

      // Парсим комплектацию и особенности
      const equipmentItems = new Set<string>();
      const featureItems = new Set<string>();

      $('.complectation_list li, .equipment_list li').each((_, element) => {
        const item = $(element).text().trim();
        if (item) {
          equipmentItems.add(item);
        }
      });

      $('.features_list li, .advantages_list li').each((_, element) => {
        const feature = $(element).text().trim();
        if (feature) {
          featureItems.add(feature);
        }
      });

      if (equipmentItems.size > 0) {
        details.equipment = Array.from(equipmentItems);
      }

      if (featureItems.size > 0) {
        details.features = Array.from(featureItems);
      }

      // Очищаем память
      $.root().empty();

      return this.validateAndCleanDetails(details);
    } catch (error) {
      this.logger.error(`Error parsing product details at ${url}: ${error.message}`);
      return this.getDefaultDetails();
    }
  }

  private normalizeImageUrl(url: string): string {
    if (!url) return '';
    return url.startsWith('http') ? url : `https://www.farniture.ru${url}`;
  }

  private validateAndCleanDetails(details: Partial<IDoor>): Partial<IDoor> {
    return {
      ...details,
      description: details.description || 'Описание отсутствует',
      specifications: Object.keys(details.specifications || {}).length > 0 ? details.specifications : undefined,
      dimensions: Object.values(details.dimensions || {}).some(v => v !== undefined) ? details.dimensions : undefined,
      materials: Object.values(details.materials || {}).some(v => v !== 'Не указан') ? details.materials : undefined,
      equipment: Array.isArray(details.equipment) && details.equipment.length > 0 ? details.equipment : undefined,
      features: details.features || [],
      manufacturer: details.manufacturer || 'Не указан',
      warranty: details.warranty || 'Не указана',
      installation: Object.keys(details.installation || {}).length > 0 ? details.installation : { opening: 'universal', type: 'Стандартная' }
    };
  }

  private getDefaultDetails(): Partial<IDoor> {
    return {
      description: 'Описание отсутствует',
      features: [],
      installation: { opening: 'universal', type: 'Стандартная' },
      manufacturer: 'Не указан',
      warranty: 'Не указана',
      materials: {
        frame: 'Не указан',
        coating: 'Не указано',
        insulation: 'Не указан'
      },
      inStock: false,
      imageUrls: [],
      thumbnailUrls: [],
      specifications: {}
    };
  }

  private async restoreFromRedis(): Promise<void> {
    if (!this.redisEnabled || !this.redisService['client']) {
      this.logger.warn('[Redis Restore] Redis is disabled or not available, skipping restoration');
      return;
    }
    
    try {
      this.logger.log('[Redis Restore] Starting restoration from Redis...');
      
      // Получаем все ключи дверей из Redis
      const redisKeys = await this.redisService['client'].keys('door:*');
      this.logger.log(`[Redis Restore] Found ${redisKeys.length} doors to restore`);
      
      let restoredCount = 0;
      let errorCount = 0;

      for (const key of redisKeys) {
        try {
          // Получаем данные двери из Redis
          const doorData = await this.redisService.get(key);
          if (!doorData) {
            this.logger.warn(`[Redis Restore] No data found for key ${key}`);
            continue;
          }

          const doorJson = JSON.parse(doorData);
          const externalId = key.replace('door:', '');

          // Проверяем, существует ли дверь уже в базе
          const existingDoor = await this.doorRepository.findOne({ where: { externalId } });
          if (existingDoor) {
            this.logger.debug(`[Redis Restore] Door ${externalId} already exists in database, skipping`);
            continue;
          }

          // Создаем объект двери для сохранения в базу
          const doorToSave = {
            externalId,
            title: doorJson.title,
            price: doorJson.price,
            oldPrice: doorJson.oldPrice,
            categoryId: doorJson.categoryId,
            imageUrls: doorJson.imageUrls || [],
            inStock: doorJson.inStock || false,
            description: doorJson.description || '',
            specifications: doorJson.specifications || {},
            url: doorJson.url
          };

          // Проверяем обязательные поля
          if (!doorToSave.title || !doorToSave.price || !doorToSave.categoryId || !doorToSave.url) {
            this.logger.error(`[Redis Restore] Missing required fields for door ${externalId}`);
            errorCount++;
            continue;
          }

          // Сохраняем в базу данных
          await this.doorRepository.save(doorToSave);
          restoredCount++;
          
          if (restoredCount % 100 === 0) {
            this.logger.log(`[Redis Restore] Progress: restored ${restoredCount} doors`);
          }
        } catch (error) {
          errorCount++;
          this.logger.error(`[Redis Restore] Error restoring door ${key}: ${error.message}`);
          this.logger.error(error.stack);
          continue;
        }
      }

      this.logger.log(`[Redis Restore] Restoration completed. Successfully restored: ${restoredCount}, Errors: ${errorCount}`);
    } catch (error) {
      this.logger.error('[Redis Restore] Error during restoration:', error);
      this.logger.error(error.stack);
      throw error;
    }
  }

  // Вспомогательный метод для создания задержки
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Обновление кеша Redis
  private async updateRedisCache(door: Door) {
    try {
      // Обновляем кеш конкретной двери
      await this.redisService.set(`door:${door.id}`, JSON.stringify(door));
      
      // Инвалидируем кеш всех дверей, чтобы он обновился при следующем запросе
      await this.redisService.del('doors:all');
      
      // Инвалидируем все кеши с фильтрами
      const filterKeys = await this.redisService.keys('doors:query:*');
      if (filterKeys.length > 0) {
        await this.redisService.del(filterKeys);
      }
      
      console.log(`✅ Redis cache updated for door ${door.id}`);
    } catch (error) {
      console.error('❌ Redis cache update error:', error);
    }
  }

  // Создание двери
  async createDoor(createDoorDto: CreateDoorDto): Promise<Door> {
    try {
      const newDoor = this.doorRepository.create({
        ...createDoorDto,
        categoryId: createDoorDto.categoryId
      });
      return await this.doorRepository.save(newDoor);
    } catch (error) {
      this.logger.error(`Error creating door: ${error.message}`);
      throw error;
    }
  }

  // Обновление двери
  async updateDoor(id: string, updateDoorDto: UpdateDoorDto): Promise<Door> {
    try {
      const doorToUpdate = await this.doorRepository.findOne({
        where: { id },
      });

      if (!doorToUpdate) {
        throw new Error(`Door with id ${id} not found`);
      }

      const updatedDoor = this.doorRepository.merge(doorToUpdate, {
        ...updateDoorDto,
        categoryId: updateDoorDto.categoryId
      });

      return await this.doorRepository.save(updatedDoor);
    } catch (error) {
      this.logger.error(`Error updating door with id ${id}: ${error.message}`);
      throw error;
    }
  }

  // Удаление двери
  async deleteDoor(id: string): Promise<void> {
    await this.doorRepository.delete(id);
    try {
      // Удаляем кеш конкретной двери
      await this.redisService.del(`door:${id}`);
      // Инвалидируем общие кеши
      await this.redisService.del('doors:all');
      const filterKeys = await this.redisService.keys('doors:query:*');
      if (filterKeys.length > 0) {
        await this.redisService.del(filterKeys);
      }
      console.log(`✅ Redis cache cleared for deleted door ${id}`);
    } catch (error) {
      console.error('❌ Redis cache deletion error:', error);
    }
  }

  // Получение дверей с использованием кеша
  async getDoors(query: any): Promise<Door[]> {
    // Если запрашиваем все двери без фильтров
    if (Object.keys(query).length === 0) {
      const cachedDoors = await this.redisService.get('doors:all');
      if (cachedDoors) {
        console.log('✅ Using cached all doors from Redis');
        return JSON.parse(cachedDoors);
      }
      
      // Если кеша нет - получаем из БД и кешируем
      const doors = await this.doorRepository.find();
      await this.redisService.set('doors:all', JSON.stringify(doors));
      return doors;
    }

    // Для запросов с фильтрами
    const cacheKey = `doors:query:${JSON.stringify(query)}`;
    const cachedData = await this.redisService.get(cacheKey);
    
    if (cachedData) {
      console.log('✅ Using cached filtered doors from Redis');
      return JSON.parse(cachedData);
    }

    const doors = await this.doorRepository.find(query);
    await this.redisService.set(cacheKey, JSON.stringify(doors), 3600);
    return doors;
  }

  // Получение одной двери по ID
  async getDoorById(id: string): Promise<Door> {
    const cacheKey = `door:${id}`;
    const cachedDoor = await this.redisService.get(cacheKey);
    
    if (cachedDoor) {
      console.log(`✅ Using cached door ${id} from Redis`);
      return JSON.parse(cachedDoor);
    }

    const door = await this.doorRepository.findOne({ where: { id } });
    if (!door) {
      throw new Error(`Door with id ${id} not found`);
    }
    await this.redisService.set(cacheKey, JSON.stringify(door));
    return door;
  }
}