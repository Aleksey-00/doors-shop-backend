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
    const batchSize = 10; // Увеличиваем размер пакета с 5 до 10
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
          if (!doorData.title || !doorData.price || !doorData.category || !doorData.url) {
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
          // Продолжаем с следующей дверью
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
      category: door.category,
      url: door.url,
      price: door.price,
      oldPrice: door.oldPrice,
      inStock: door.inStock,
      description: door.description,
      specifications: door.specifications,
      imageUrls: door.imageUrls
    };
  }

  private async parseCategory(category: string): Promise<IDoor[]> {
    const url = `${this.baseUrl}/${category}/`;
    const doors: IDoor[] = [];

    try {
      this.logger.log(`Starting to parse category: ${category}`);
      
      // Увеличиваем задержку перед запросом
      await this.delay(5000);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0'
        },
        timeout: 30000, // Увеличиваем таймаут до 30 секунд
        maxContentLength: 10 * 1024 * 1024 // Ограничиваем размер ответа 10MB
      });

      // Очищаем response.data после использования
      const html = response.data;
      response.data = null;

      const $ = cheerio.load(html);
      this.logger.log(`Successfully loaded HTML for category: ${category}`);

      // Очищаем переменную html после загрузки в cheerio
      html.length = 0;

      // Собираем ссылки на подкатегории
      const subcategoryLinks = new Set<string>();
      $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.includes(`/catalog/vkhodnye/${category}/`)) {
          subcategoryLinks.add(href);
        }
      });

      const uniqueSubcategoryLinks = Array.from(subcategoryLinks)
        .filter(link => !link.includes('?'));
      
      this.logger.log(`Found ${uniqueSubcategoryLinks.length} unique subcategories in ${category}`);

      // Парсим двери на текущей странице
      await this.parseDoors($, category, doors);

      // Очищаем cheerio объект
      $.root().empty();
      
      // Парсим подкатегории с увеличенными интервалами
      for (const subcategoryUrl of uniqueSubcategoryLinks) {
        try {
          this.logger.log(`Parsing subcategory: ${subcategoryUrl}`);
          
          // Увеличиваем задержку между запросами подкатегорий
          await this.delay(10000);
          
          const subcategoryResponse = await axios.get(`https://www.farniture.ru${subcategoryUrl}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
            },
            timeout: 30000,
            maxContentLength: 10 * 1024 * 1024
          });

          const subcategoryHtml = subcategoryResponse.data;
          subcategoryResponse.data = null;

          const $subcategory = cheerio.load(subcategoryHtml);
          await this.parseDoors($subcategory, category, doors);

          // Очищаем cheerio объект и HTML
          $subcategory.root().empty();
          subcategoryHtml.length = 0;

          // Принудительная очистка памяти после каждой подкатегории
          if (global.gc) {
            global.gc();
          }
        } catch (error) {
          this.logger.error(`Error parsing subcategory ${subcategoryUrl}: ${error.message}`);
        }
      }

    } catch (error) {
      this.logger.error(`Error fetching category ${category}: ${error.message}`);
      this.logger.error(error.stack);
    }

    return doors;
  }

  private async parseDoors($: cheerio.CheerioAPI, category: string, doors: IDoor[]): Promise<void> {
    // Уменьшаем размер пакета для обработки
    const batchSize = 5;
    let doorCards = $('.catalog_item_wrapp.catalog_item.item_wrap');
    
    if (doorCards.length === 0) {
      const alternativeSelectors = [
        '.catalog_block .catalog_item',
        '.product-item-container',
        '.js-product-item',
        '.item.product-item'
      ];
      
      for (const selector of alternativeSelectors) {
        const altCards = $(selector);
        if (altCards.length > 0) {
          doorCards = altCards as any;
          break;
        }
      }
    }

    const doorCardsArray = doorCards.toArray();
    
    for (let i = 0; i < doorCardsArray.length; i += batchSize) {
      const batch = doorCardsArray.slice(i, i + batchSize);
      
      // Увеличиваем интервал между пакетами
      if (i > 0) {
        await this.delay(5000);
      }
      
      for (const card of batch) {
        try {
          const $card = $(card);
          
          const title = $card.find('.item-title a span').text().trim();
          const priceText = $card.find('.price.font-bold.font_mxs').attr('data-value') || '';
          const oldPriceText = $card.find('.price.discount').attr('data-value') || '';
          
          const imageUrls: string[] = [];
          $card.find('.section-gallery-wrapper__item img.img-responsive').each((_, img) => {
            const imgUrl = $(img).attr('data-src') || $(img).attr('src');
            if (imgUrl && !imgUrl.includes('double_ring.svg')) {
              const fullUrl = imgUrl.startsWith('http') ? imgUrl : `https://www.farniture.ru${imgUrl}`;
              if (!imageUrls.includes(fullUrl)) {
                imageUrls.push(fullUrl.replace(/";$/, '')); // Удаляем лишние символы в конце URL
              }
            }
          });

          if (imageUrls.length === 0) {
            const mainImage = $card.find('.image_wrapper_block img.img-responsive');
            mainImage.each((_, img) => {
              const imgUrl = $(img).attr('data-src') || $(img).attr('src');
              if (imgUrl && !imgUrl.includes('double_ring.svg')) {
                const fullUrl = imgUrl.startsWith('http') ? imgUrl : `https://www.farniture.ru${imgUrl}`;
                if (!imageUrls.includes(fullUrl)) {
                  imageUrls.push(fullUrl.replace(/";$/, '')); // Удаляем лишние символы в конце URL
                }
              }
            });
          }

          if (!title || !priceText) {
            continue;
          }

          const productUrl = $card.find('.item-title a').attr('href');
          const stockBlock = $card.find('.item-stock');
          const inStock = stockBlock.length > 0 && stockBlock.find('.value').text().includes('Есть в наличии');

          const door: IDoor = {
            title,
            price: parseInt(priceText) || 0,
            oldPrice: oldPriceText ? parseInt(oldPriceText) : undefined,
            category,
            imageUrls,
            inStock,
            url: productUrl ? (productUrl.startsWith('http') ? productUrl : `https://www.farniture.ru${productUrl}`) : '',
            features: [], // Инициализируем пустым массивом
            installation: {}, // Инициализируем пустым объектом
          };

          if (productUrl) {
            try {
              await this.delay(3000);
              const details = await this.parseProductDetails(door.url);
              Object.assign(door, details);
            } catch (error) {
              this.logger.warn(`Error parsing details for ${title}: ${error.message}`);
            }
          }

          doors.push(door);
          this.logger.debug(`Successfully parsed door: ${title}`);
        } catch (error) {
          this.logger.error(`Error parsing door card: ${error.message}`);
          continue;
        }
      }

      // Очищаем память после каждого пакета
      if (global.gc) {
        global.gc();
      }
    }
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
      const $ = cheerio.load(html);

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
      details.title = $('#pagetitle').text().trim();
      details.url = url;

      // Парсим цены
      const priceBlock = $('.cost.prices.detail');
      details.price = parseFloat(priceBlock.find('.price_value').first().text().replace(/\s+/g, '')) || 0;
      details.oldPrice = parseFloat(priceBlock.find('.price.discount .price_value').text().replace(/\s+/g, '')) || undefined;
      details.priceUnit = priceBlock.find('.price_measure').text().trim() || 'шт';

      // Парсим акционную информацию
      const saleBlock = $('.view_sale_block');
      if (saleBlock.length > 0) {
        details.sale = {
          endDate: saleBlock.find('.active_to').text().trim(),
          remainingQuantity: parseInt(saleBlock.find('.quantity_block .value').text().trim()) || 0
        };
      }

      // Парсим наличие
      const stockBlock = $('.item-stock');
      details.inStock = stockBlock.find('.value').text().includes('Есть в наличии');

      // Парсим описание
      details.description = $('.detail-text-wrap').text().trim() || 'Описание отсутствует';

      // Парсим характеристики
      $('.props_list tr').each((_, row) => {
        const key = $(row).find('.char_name').text().trim().toLowerCase();
        const value = $(row).find('.char_value').text().trim();

        if (!key || !value) return;

        details.specifications[key] = value;

        // Обработка специфических характеристик
        if (key.includes('количество замков')) {
          details.lockCount = parseInt(value) || 1;
        } else if (key.includes('толщина металла')) {
          details.metalThickness = parseFloat(value) || 1.5;
        } else if (key.includes('толщина полотна')) {
          details.doorThickness = parseInt(value) || 60;
        } else if (key.includes('наружная отделка')) {
          details.exteriorFinish = value;
        } else if (key.includes('внутренняя отделка')) {
          details.interiorFinish = value;
        } else if (key.includes('цвет изнутри')) {
          details.interiorColor = value;
        } else if (key.includes('цвет снаружи')) {
          details.exteriorColor = value;
        } else if (key.includes('размеры')) {
          details.sizes = value.split(',').map(size => size.trim());
        } else if (key.includes('страна')) {
          details.country = value;
        }
      });

      // Парсим изображения
      details.imageUrls = [];
      details.thumbnailUrls = [];

      // Основное изображение
      const mainImage = $('.product-detail-gallery__picture').attr('src');
      if (mainImage) {
        details.imageUrls.push(this.normalizeImageUrl(mainImage));
      }

      // Дополнительные изображения
      $('.product-detail-gallery__link').each((_, element) => {
        const imgUrl = $(element).attr('href');
        const thumbUrl = $(element).attr('data-thumb');
        if (imgUrl) {
          details.imageUrls.push(this.normalizeImageUrl(imgUrl));
        }
        if (thumbUrl) {
          details.thumbnailUrls.push(this.normalizeImageUrl(thumbUrl));
        }
      });

      // Парсим информацию о бренде
      const brandBlock = $('.brand');
      if (brandBlock.length > 0) {
        details.brand = {
          name: brandBlock.find('meta[itemprop="name"]').attr('content') || 'Не указан',
          logo: this.normalizeImageUrl(brandBlock.find('img').attr('src') || ''),
          url: brandBlock.find('a').attr('href') || ''
        };
      }

      // Парсим рейтинг и отзывы
      const ratingBlock = $('.rating');
      if (ratingBlock.length > 0) {
        details.rating = {
          value: parseFloat(ratingBlock.find('meta[itemprop="ratingValue"]').attr('content') || '0'),
          count: parseInt(ratingBlock.find('meta[itemprop="reviewCount"]').attr('content') || '0')
        };
      }

      // Парсим комплектацию
      const equipmentItems = new Set<string>();
      $('.complectation_list li, .equipment_list li').each((_, element) => {
        const item = $(element).text().trim();
        if (item) {
          equipmentItems.add(item);
        }
      });

      // Парсим особенности
      const featureItems = new Set<string>();
      $('.features_list li, .advantages_list li').each((_, element) => {
        const feature = $(element).text().trim();
        if (feature) {
          featureItems.add(feature);
        }
      });

      details.equipment = Array.from(equipmentItems);
      details.features = Array.from(featureItems);

      // Очищаем память
      $.root().empty();
      html.length = 0;

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
            category: doorJson.category,
            imageUrls: doorJson.imageUrls || [],
            inStock: doorJson.inStock || false,
            description: doorJson.description || '',
            specifications: doorJson.specifications || {},
            url: doorJson.url
          };

          // Проверяем обязательные поля
          if (!doorToSave.title || !doorToSave.price || !doorToSave.category || !doorToSave.url) {
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
    const door = await this.doorRepository.save(createDoorDto);
    await this.updateRedisCache(door);
    return door;
  }

  // Обновление двери
  async updateDoor(id: string, updateDoorDto: UpdateDoorDto): Promise<Door> {
    await this.doorRepository.update(id, updateDoorDto);
    const updatedDoor = await this.doorRepository.findOne({ where: { id } });
    if (!updatedDoor) {
      throw new Error(`Door with id ${id} not found`);
    }
    await this.updateRedisCache(updatedDoor);
    return updatedDoor;
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