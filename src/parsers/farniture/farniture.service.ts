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
      // Двойная проверка перед парсингом
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
      
      // Ограничиваем количество категорий для парсинга
      const limitedCategories = this.categories.slice(0, 3); // Берем только первые 3 категории
      this.logger.log(`[Parser] Limited to ${limitedCategories.length} categories: ${limitedCategories.join(', ')}`);
      
      // Добавляем обработку каждой категории отдельно с повторными попытками
      let totalParsedDoors = 0;
      let totalSavedDoors = 0;
      
      // Обрабатываем категории последовательно
      for (const category of limitedCategories) {
        try {
          this.logger.log(`[Parser] Starting to parse category: ${category}`);
          
          // Добавляем задержку между категориями
          if (totalParsedDoors > 0) {
            this.logger.log(`[Parser] Waiting 5 seconds before parsing next category...`);
            await this.delay(5000);
          }
          
          const doors = await this.parseCategory(category);
          
          // Сразу сохраняем двери из этой категории
          if (doors.length > 0) {
            this.logger.log(`[Parser] Saving ${doors.length} doors from category ${category}`);
            const savedCount = await this.saveDoors(doors);
            totalParsedDoors += doors.length;
            totalSavedDoors += savedCount;
            
            // Проверяем промежуточные результаты
            this.logger.log(`[Parser] Progress: parsed ${totalParsedDoors} doors, saved ${totalSavedDoors} doors`);
            
            // Если уже собрали достаточно дверей, останавливаем парсинг
            if (totalSavedDoors >= 100) {
              this.logger.log(`[Parser] Reached limit of 100 saved doors, stopping parsing`);
              break;
            }
          }
        } catch (error) {
          this.logger.error(`[Parser] Error parsing category ${category}: ${error.message}`);
          // Продолжаем с следующей категорией
          continue;
        }
      }
      
      // Проверяем результаты сохранения
      const savedDbCount = await this.doorRepository.count();
      let savedRedisCount = 0;
      
      if (this.redisEnabled && this.redisService['client']) {
        try {
          savedRedisCount = (await this.redisService['client'].keys('door:*')).length;
        } catch (error) {
          this.logger.error(`[Parser] Error accessing Redis: ${error.message}`);
        }
      }
      
      this.logger.log(`[Parser] Parsing results:
        - Total parsed: ${totalParsedDoors} doors
        - Total saved: ${totalSavedDoors} doors
        - Saved in database: ${savedDbCount} doors
        - Saved in Redis: ${savedRedisCount} doors`);
        
      return { 
        totalDoors: totalParsedDoors,
        savedDoors: totalSavedDoors,
        savedInDb: savedDbCount,
        savedInRedis: savedRedisCount
      };
    } catch (error) {
      this.logger.error('[Parser] Error during parsing:', error);
      throw error;
    }
  }

  private async saveDoors(doors: IDoor[]): Promise<number> {
    let savedCount = 0;
    
    // Разбиваем двери на пакеты по 5 штук для снижения нагрузки на БД
    const batchSize = 5;
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
        await this.delay(1000);
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

  private async parseAllCategories(): Promise<IDoor[]> {
    const allDoors: IDoor[] = [];
    let savedDoorsCount = 0;
    
    for (const category of this.categories) {
      try {
        this.logger.log(`[Parser] Starting to parse category: ${category}`);
        const doors = await this.parseCategory(category);
        this.logger.log(`[Parser] Found ${doors.length} doors in category ${category}`);
        
        // Сохраняем двери из категории
        for (const doorData of doors) {
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

            savedDoorsCount++;
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
            
            allDoors.push(doorData);
          } catch (error) {
            this.logger.error(`[Parser] Error saving door: ${error.message}`);
            continue;
          }
        }
      } catch (error) {
        this.logger.error(`[Parser] Error parsing category ${category}: ${error.message}`);
        continue;
      }
    }
    
    this.logger.log(`[Parser] Total doors parsed: ${allDoors.length}, saved: ${savedDoorsCount}`);
    return allDoors;
  }

  private async parseCategory(category: string): Promise<IDoor[]> {
    const url = `${this.baseUrl}/${category}/`;
    const doors: IDoor[] = [];

    try {
      this.logger.log(`Starting to parse category: ${category}`);
      
      // Добавляем задержку перед запросом, чтобы не перегружать сервер
      await this.delay(1000);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0'
        },
        // Добавляем таймаут для запроса
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      this.logger.log(`Successfully loaded HTML for category: ${category}`);

      // Выводим HTML для анализа
      this.logger.debug(`HTML preview: ${response.data.substring(0, 1000)}`);

      // Сначала собираем все ссылки на подкатегории
      const subcategoryLinks = new Set<string>();
      $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.includes(`/catalog/vkhodnye/${category}/`)) {
          subcategoryLinks.add(href);
          this.logger.debug(`Found subcategory link: ${href}`);
        }
      });

      // Ограничиваем количество подкатегорий для парсинга
      const uniqueSubcategoryLinks = Array.from(subcategoryLinks)
        .filter(link => !link.includes('?')) // Исключаем ссылки с параметрами (сортировка, пагинация)
        .slice(0, 3); // Берем только первые 3 уникальных подкатегории (уменьшаем с 5 до 3)
      
      this.logger.log(`Filtered from ${subcategoryLinks.size} to ${uniqueSubcategoryLinks.length} unique subcategories in ${category}`);

      // Парсим двери на текущей странице
      await this.parseDoors($, category, doors);

      // Ограничиваем количество дверей для одной категории
      if (doors.length >= 50) {
        this.logger.log(`Reached limit of 50 doors for category ${category}, skipping subcategories`);
        return doors.slice(0, 50); // Возвращаем только первые 50 дверей
      }

      // Парсим каждую подкатегорию последовательно
      for (const subcategoryUrl of uniqueSubcategoryLinks) {
        try {
          this.logger.log(`Parsing subcategory: ${subcategoryUrl}`);
          
          // Добавляем задержку между запросами
          await this.delay(1500);
          
          const subcategoryResponse = await axios.get(`https://www.farniture.ru${subcategoryUrl}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
            },
            timeout: 10000
          });

          const $subcategory = cheerio.load(subcategoryResponse.data);
          await this.parseDoors($subcategory, category, doors);
          
          // Проверяем количество дверей после каждой подкатегории
          if (doors.length >= 50) {
            this.logger.log(`Reached limit of 50 doors for category ${category}, stopping parsing`);
            return doors.slice(0, 50); // Возвращаем только первые 50 дверей
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
    let doorCards = $('.catalog_item_wrapp.catalog_item.item_wrap');
    
    this.logger.log(`Found ${doorCards.length} doors in category/subcategory`);
    
    // Если не нашли двери по основному селектору, попробуем альтернативные
    if (doorCards.length === 0) {
      this.logger.warn(`No doors found with primary selector, trying alternatives...`);
      
      // Логируем часть HTML для анализа
      this.logger.debug(`HTML preview: ${$.html().substring(0, 2000)}`);
      
      // Пробуем альтернативные селекторы
      const alternativeSelectors = [
        '.catalog_block .catalog_item',
        '.product-item-container',
        '.js-product-item',
        '.item.product-item'
      ];
      
      for (const selector of alternativeSelectors) {
        const altCards = $(selector);
        this.logger.debug(`Selector "${selector}" found ${altCards.length} elements`);
        
        if (altCards.length > 0) {
          // Используем тип any для обхода проблемы с типами
          doorCards = altCards as any;
          this.logger.log(`Using alternative selector "${selector}", found ${doorCards.length} doors`);
          break;
        }
      }
    }

    // Ограничиваем количество карточек для обработки
    const maxCards = Math.min(doorCards.length, 10); // Обрабатываем не более 10 карточек за раз
    this.logger.log(`Processing ${maxCards} out of ${doorCards.length} door cards`);
    
    // Преобразуем коллекцию в массив и берем только первые maxCards элементов
    const doorCardsArray = doorCards.toArray().slice(0, maxCards);

    for (const card of doorCardsArray) {
      try {
        const $card = $(card);
        
        // Получаем основные данные о двери
        const title = $card.find('.item-title a span').text().trim();
        const priceText = $card.find('.price.font-bold.font_mxs').attr('data-value') || '';
        const oldPriceText = $card.find('.price.discount').attr('data-value') || '';
        
        // Получаем все изображения из галереи
        const imageUrls: string[] = [];
        $card.find('.section-gallery-wrapper__item img.img-responsive').each((_, img) => {
          // Пробуем получить URL из data-src сначала, так как там обычно хранится реальный URL изображения
          const imgUrl = $(img).attr('data-src') || $(img).attr('src');
          
          // Проверяем, что URL не содержит double_ring.svg и не пустой
          if (imgUrl && !imgUrl.includes('double_ring.svg')) {
            const fullUrl = imgUrl.startsWith('http') ? imgUrl : `https://www.farniture.ru${imgUrl}`;
            // Проверяем, что такого URL еще нет в массиве
            if (!imageUrls.includes(fullUrl)) {
              imageUrls.push(fullUrl);
            }
          }
        });

        // Если изображения не найдены в галерее, попробуем поискать в других местах
        if (imageUrls.length === 0) {
          const mainImage = $card.find('.image_wrapper_block img.img-responsive');
          mainImage.each((_, img) => {
            const imgUrl = $(img).attr('data-src') || $(img).attr('src');
            if (imgUrl && !imgUrl.includes('double_ring.svg')) {
              const fullUrl = imgUrl.startsWith('http') ? imgUrl : `https://www.farniture.ru${imgUrl}`;
              if (!imageUrls.includes(fullUrl)) {
                imageUrls.push(fullUrl);
              }
            }
          });
        }

        this.logger.debug(`Found ${imageUrls.length} images for door: ${title}`);
        this.logger.debug(`Image URLs: ${JSON.stringify(imageUrls, null, 2)}`);

        // Пропускаем дверь, если не нашли ни одного изображения
        if (imageUrls.length === 0) {
          this.logger.warn(`Skipping door "${title}" - no valid images found`);
          continue;
        }

        const productUrl = $card.find('.item-title a').attr('href');
        const stockBlock = $card.find('.item-stock');
        const inStock = stockBlock.length > 0 && stockBlock.find('.value').text().includes('Есть в наличии');

        if (!title || !priceText) {
          this.logger.warn(`Skipping door due to missing required data (title: ${!!title}, price: ${!!priceText})`);
          continue;
        }

        const door: IDoor = {
          title,
          price: parseInt(priceText) || 0,
          oldPrice: oldPriceText ? parseInt(oldPriceText) : undefined,
          category,
          imageUrls,
          inStock,
          url: productUrl ? (productUrl.startsWith('http') ? productUrl : `https://www.farniture.ru${productUrl}`) : '',
        };

        // Ограничиваем парсинг деталей продукта
        // Вместо запроса деталей для каждой двери, делаем это только для каждой третьей
        if (productUrl && doors.length % 3 === 0) {
          try {
            // Добавляем задержку перед запросом деталей
            await this.delay(1000);
            
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

    // Ограничиваем пагинацию - не переходим на следующие страницы, если уже собрали достаточно дверей
    if (doors.length < 50) {
      const nextPageLink = $('[data-entity="pagination"] .next a').attr('href');
      if (nextPageLink) {
        try {
          this.logger.log(`Found next page: ${nextPageLink}`);
          
          // Добавляем задержку перед запросом следующей страницы
          await this.delay(2000);
          
          const nextPageResponse = await axios.get(`https://www.farniture.ru${nextPageLink}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
          });
          const $nextPage = cheerio.load(nextPageResponse.data);
          await this.parseDoors($nextPage, category, doors);
        } catch (error) {
          this.logger.error(`Error parsing next page ${nextPageLink}: ${error.message}`);
        }
      }
    } else {
      this.logger.log(`Skipping pagination as we already have ${doors.length} doors`);
    }
  }

  private async parseProductDetails(url: string): Promise<Partial<IDoor>> {
    try {
      this.logger.log(`Parsing product details from: ${url}`);
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);

      // Получаем описание товара
      const description = $('.detail-text-wrap').text().trim();
      
      // Получаем характеристики товара
      const specifications: Record<string, string> = {};
      $('.props_list tr').each((_, element) => {
        const $element = $(element);
        const key = $element.find('.char_name span').text().trim();
        const value = $element.find('.char_value span').text().trim();
        if (key && value) {
          specifications[key] = value;
        }
      });

      this.logger.debug(`Parsed details - Description length: ${description.length}, Specifications count: ${Object.keys(specifications).length}`);

      return {
        description,
        specifications: Object.keys(specifications).length > 0 ? specifications : undefined
      };
    } catch (error) {
      this.logger.error(`Error parsing product details at ${url}: ${error.message}`);
      return {};
    }
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
}