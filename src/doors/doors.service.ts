import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Door } from '../parsers/farniture/entities/door.entity';
import { RedisService } from '../redis/redis.service';
import { In } from 'typeorm';
import { ErrorHandler } from '../utils/error-handler';

interface FindAllFilters {
  category?: string;
  priceMin?: number;
  priceMax?: number;
  inStock?: boolean;
  sort?: 'popular' | 'price_asc' | 'price_desc' | 'new';
}

@Injectable()
export class DoorsService {
  private readonly logger = new Logger(DoorsService.name);
  private readonly errorHandler: ErrorHandler;

  constructor(
    @InjectRepository(Door)
    private readonly doorRepository: Repository<Door>,
    private readonly redisService: RedisService,
  ) {
    this.errorHandler = new ErrorHandler(this.logger);
    
    // Проверяем подключение к базе данных при инициализации сервиса
    this.logger.log('DoorsService initialized');
    this.doorRepository.count()
      .then(count => {
        this.logger.log(`Database connection successful, found ${count} doors`);
      })
      .catch(error => {
        this.logger.error(`Database connection error: ${error.message}`);
        this.logger.error(error.stack);
      });
  }

  async findAll(page: number = 1, limit: number = 10, filters: FindAllFilters = {}): Promise<{ doors: Door[]; total: number; totalPages: number }> {
    this.logger.log(`Finding doors with page=${page}, limit=${limit}, filters=${JSON.stringify(filters)}`);
    
    // Пробуем получить данные из кэша
    const cacheKey = `doors:list:${page}:${limit}:${JSON.stringify(filters)}`;
    const cachedData = await this.redisService.get(cacheKey);
    
    if (cachedData) {
      this.logger.log(`Found cached data for key: ${cacheKey}`);
      return JSON.parse(cachedData);
    }

    this.logger.log('No cached data found, querying database');
    
    const queryBuilder = this.doorRepository.createQueryBuilder('door');

    // Применяем фильтры
    if (filters.category) {
      queryBuilder.where('door.category ILIKE :category', { category: `%${filters.category}%` });
    }

    if (filters.priceMin !== undefined) {
      queryBuilder.andWhere('door.price >= :priceMin', { priceMin: filters.priceMin });
    }

    if (filters.priceMax !== undefined) {
      queryBuilder.andWhere('door.price <= :priceMax', { priceMax: filters.priceMax });
    }

    if (filters.inStock !== undefined) {
      queryBuilder.andWhere('door.inStock = :inStock', { inStock: filters.inStock });
    }

    // Применяем сортировку
    switch (filters.sort) {
      case 'price_asc':
        queryBuilder.orderBy('door.price', 'ASC');
        break;
      case 'price_desc':
        queryBuilder.orderBy('door.price', 'DESC');
        break;
      case 'new':
        queryBuilder.orderBy('door.updatedAt', 'DESC');
        break;
      case 'popular':
      default:
        // По умолчанию сортируем по ID в обратном порядке (самые новые первыми)
        queryBuilder.orderBy('door.id', 'DESC');
        break;
    }

    // Применяем пагинацию
    queryBuilder
      .skip((page - 1) * limit)
      .take(limit);

    try {
      this.logger.log(`Executing query: ${queryBuilder.getSql()}`);
      const [doors, total] = await queryBuilder.getManyAndCount();
      this.logger.log(`Query result: ${doors.length} doors found, total: ${total}`);

      const result = {
        doors,
        total,
        totalPages: Math.ceil(total / limit),
      };

      // Кэшируем результат
      await this.redisService.set(cacheKey, JSON.stringify(result));
      this.logger.log(`Cached result with key: ${cacheKey}`);

      return result;
    } catch (error) {
      this.logger.error(`Error executing query: ${error.message}`);
      this.logger.error(error.stack);
      throw error;
    }
  }

  private async invalidateCache(): Promise<void> {
    await this.errorHandler.handleCacheOperation(
      async () => {
        const keys = await this.redisService.keys('doors:list:*');
        if (keys.length > 0) {
          await this.redisService.del(keys);
        }
      },
      'Error invalidating cache'
    );
  }

  async create(door: Partial<Door>): Promise<Door> {
    try {
      const newDoor = this.doorRepository.create(door);
      const savedDoor = await this.doorRepository.save(newDoor);
      
      await this.invalidateCache();
      
      this.logger.log(`Successfully created door with ID ${savedDoor.id}`);
      return savedDoor;
    } catch (error) {
      this.logger.error(`Error in create: ${error.message}`);
      this.logger.error(error.stack);
      throw error;
    }
  }

  async updateTitlesInCategory(category: string, searchText: string, replaceText: string) {
    try {
      const doors = await this.doorRepository.find({
        where: { category },
      });

      this.logger.log(`Found ${doors.length} doors in category "${category}" for title update`);

      const updates = doors.map(async (door) => {
        try {
          if (door.title.includes(searchText)) {
            const uuid = require('crypto').randomUUID().substring(0, 7);
            const regex = new RegExp(searchText, 'g');
            const newTitle = door.title.replace(regex, `${replaceText} ${uuid}`);
            door.title = newTitle;
            await this.doorRepository.save(door);
            
            await this.errorHandler.handleCacheOperation(
              async () => {
                const cachedData = await this.redisService.get(`door:${door.externalId}`);
                if (cachedData) {
                  const doorData = JSON.parse(cachedData);
                  doorData.title = door.title;
                  await this.redisService.set(
                    `door:${door.externalId}`,
                    JSON.stringify(doorData)
                  );
                }
              },
              `Error updating Redis cache for door ${door.id}`
            );
          }
        } catch (doorError) {
          this.logger.error(`Error updating door ${door.id}: ${doorError.message}`);
          // Продолжаем с другими дверями, даже если обновление одной не удалось
        }
      });

      await Promise.all(updates);
      await this.invalidateCache();
      
      this.logger.log(`Successfully updated titles in category "${category}"`);
      return { success: true, message: `Заголовки успешно обновлены в категории "${category || 'все категории'}"` };
    } catch (error) {
      this.logger.error(`Error in updateTitlesInCategory: ${error.message}`);
      this.logger.error(error.stack);
      return { success: false, message: `Ошибка при обновлении заголовков: ${error.message}` };
    }
  }

  async updatePrices(category: string | undefined, increasePercent: number) {
    try {
      const queryBuilder = this.doorRepository.createQueryBuilder('door');

      if (category) {
        queryBuilder.where('door.category = :category', { category });
      }

      // Получаем только ID дверей для пакетной обработки
      const doorIds = await queryBuilder.select('door.id').getRawMany();
      this.logger.log(`Found ${doorIds.length} doors for price update, increase by ${increasePercent}%`);

      // Размер пакета
      const batchSize = 100;
      let updatedCount = 0;

      // Обрабатываем двери пакетами
      for (let i = 0; i < doorIds.length; i += batchSize) {
        const batchIds = doorIds.slice(i, i + batchSize).map(item => item.door_id);
        this.logger.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(doorIds.length / batchSize)}, size: ${batchIds.length}`);
        
        // Получаем двери текущего пакета
        const doors = await this.doorRepository.findBy({
          id: In(batchIds)
        });
        
        // Обновляем цены
        for (const door of doors) {
          door.price = Math.round(door.price * (1 + increasePercent / 100));
          if (door.oldPrice) {
            door.oldPrice = Math.round(door.oldPrice * (1 + increasePercent / 100));
          }
        }

        // Сохраняем пакет
        await this.doorRepository.save(doors);
        updatedCount += doors.length;
        this.logger.log(`Batch ${i / batchSize + 1} completed, updated ${doors.length} doors, total: ${updatedCount}`);
      }
      
      // Очищаем кэш с обработкой ошибок
      try {
        await this.invalidateCache();
      } catch (cacheError) {
        this.logger.error(`Error invalidating cache: ${cacheError.message}`);
        // Продолжаем выполнение, даже если очистка кэша не удалась
      }
      
      this.logger.log(`Successfully updated prices for ${updatedCount} doors`);
      return { success: true, message: `Цены успешно обновлены${category ? ` в категории "${category}"` : ' во всех категориях'}` };
    } catch (error) {
      this.logger.error(`Error in updatePrices: ${error.message}`);
      this.logger.error(error.stack);
      return { success: false, message: `Ошибка при обновлении цен: ${error.message}` };
    }
  }
} 