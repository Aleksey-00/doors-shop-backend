import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Door } from '../parsers/farniture/entities/door.entity';
import { RedisService } from '../redis/redis.service';

interface FindAllFilters {
  category?: string;
  priceMin?: number;
  priceMax?: number;
  inStock?: boolean;
}

@Injectable()
export class DoorsService {
  private readonly logger = new Logger(DoorsService.name);

  constructor(
    @InjectRepository(Door)
    private readonly doorRepository: Repository<Door>,
    private readonly redisService: RedisService,
  ) {
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
    
    // Прямой SQL-запрос для отладки
    try {
      const rawDoors = await this.doorRepository.query('SELECT COUNT(*) FROM doors');
      this.logger.log(`Raw SQL count result: ${JSON.stringify(rawDoors)}`);
      
      const sampleDoors = await this.doorRepository.query('SELECT id, title, price FROM doors LIMIT 5');
      this.logger.log(`Sample doors: ${JSON.stringify(sampleDoors)}`);
    } catch (sqlError) {
      this.logger.error(`Error executing raw SQL: ${sqlError.message}`);
      this.logger.error(sqlError.stack);
    }
    
    // Попробуем использовать find вместо queryBuilder
    try {
      const skip = (page - 1) * limit;
      const [doors, total] = await Promise.all([
        this.doorRepository.find({
          skip,
          take: limit,
          order: { id: 'DESC' }
        }),
        this.doorRepository.count()
      ]);
      
      this.logger.log(`Find result: ${doors.length} doors found, total: ${total}`);
      
      const result = {
        doors,
        total,
        totalPages: Math.ceil(total / limit),
      };
      
      // Кэшируем результат без TTL
      await this.redisService.set(cacheKey, JSON.stringify(result));
      this.logger.log(`Cached result with key: ${cacheKey}`);
      
      return result;
    } catch (findError) {
      this.logger.error(`Error executing find: ${findError.message}`);
      this.logger.error(findError.stack);
    }
    
    // Если find не сработал, используем queryBuilder
    const queryBuilder = this.doorRepository.createQueryBuilder('door');

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

    queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('door.id', 'DESC');

    try {
      this.logger.log(`Executing query: ${queryBuilder.getSql()}`);
      const [doors, total] = await queryBuilder.getManyAndCount();
      this.logger.log(`Query result: ${doors.length} doors found, total: ${total}`);

      const result = {
        doors,
        total,
        totalPages: Math.ceil(total / limit),
      };

      // Кэшируем результат без TTL
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
    try {
      // Используем публичный метод keys вместо прямого доступа к client
      const keys = await this.redisService.keys('doors:list:*');
      if (keys.length > 0) {
        // Используем публичный метод del вместо прямого доступа к client
        await this.redisService.del(keys);
      }
    } catch (error) {
      this.logger.error(`Error invalidating cache: ${error.message}`);
      // Продолжаем выполнение, даже если очистка кэша не удалась
    }
  }

  async create(door: Partial<Door>): Promise<Door> {
    try {
      const newDoor = this.doorRepository.create(door);
      const savedDoor = await this.doorRepository.save(newDoor);
      
      // Очищаем кэш с обработкой ошибок
      try {
        await this.invalidateCache();
      } catch (cacheError) {
        this.logger.error(`Error invalidating cache: ${cacheError.message}`);
        // Продолжаем выполнение, даже если очистка кэша не удалась
      }
      
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
            // Генерируем UUID и берем первые 7 символов
            const uuid = require('crypto').randomUUID().substring(0, 7);
            // Добавляем UUID к замененному тексту
            // Используем регулярное выражение для замены всех вхождений
            const regex = new RegExp(searchText, 'g');
            const newTitle = door.title.replace(regex, `${replaceText} ${uuid}`);
            door.title = newTitle;
            await this.doorRepository.save(door);
            
            // Обновляем кэш в Redis с обработкой ошибок
            try {
              const cachedData = await this.redisService.get(`door:${door.externalId}`);
              if (cachedData) {
                const doorData = JSON.parse(cachedData);
                doorData.title = door.title;
                await this.redisService.set(
                  `door:${door.externalId}`,
                  JSON.stringify(doorData)
                );
              }
            } catch (redisError) {
              this.logger.error(`Error updating Redis cache for door ${door.id}: ${redisError.message}`);
              // Продолжаем выполнение, даже если обновление кэша не удалось
            }
          }
        } catch (doorError) {
          this.logger.error(`Error updating door ${door.id}: ${doorError.message}`);
          // Продолжаем с другими дверями, даже если обновление одной не удалось
        }
      });

      await Promise.all(updates);
      
      // Очищаем кэш с обработкой ошибок
      try {
        await this.invalidateCache();
      } catch (cacheError) {
        this.logger.error(`Error invalidating cache: ${cacheError.message}`);
        // Продолжаем выполнение, даже если очистка кэша не удалась
      }
      
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

      const doors = await queryBuilder.getMany();
      this.logger.log(`Found ${doors.length} doors for price update, increase by ${increasePercent}%`);

      for (const door of doors) {
        door.price = Math.round(door.price * (1 + increasePercent / 100));
        if (door.oldPrice) {
          door.oldPrice = Math.round(door.oldPrice * (1 + increasePercent / 100));
        }
      }

      await this.doorRepository.save(doors);
      
      // Очищаем кэш с обработкой ошибок
      try {
        await this.invalidateCache();
      } catch (cacheError) {
        this.logger.error(`Error invalidating cache: ${cacheError.message}`);
        // Продолжаем выполнение, даже если очистка кэша не удалась
      }
      
      this.logger.log(`Successfully updated prices for ${doors.length} doors`);
      return { success: true, message: `Цены успешно обновлены${category ? ` в категории "${category}"` : ' во всех категориях'}` };
    } catch (error) {
      this.logger.error(`Error in updatePrices: ${error.message}`);
      this.logger.error(error.stack);
      return { success: false, message: `Ошибка при обновлении цен: ${error.message}` };
    }
  }
} 