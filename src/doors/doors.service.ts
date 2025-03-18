import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Door } from '../parsers/farniture/entities/door.entity';
import { RedisService } from '../redis/redis.service';
import { In } from 'typeorm';
import { ErrorHandler } from '../utils/error-handler';
import { Category } from '../categories/entities/category.entity';

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
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
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

  async findAll(filters: FindAllFilters = {}): Promise<Door[]> {
    this.logger.log(`Finding doors with filters: ${JSON.stringify(filters)}`);
    
    const queryBuilder = this.doorRepository.createQueryBuilder('door')
      .leftJoinAndSelect('door.category', 'category');

    if (filters.category) {
      queryBuilder.andWhere('category.name = :category', { category: filters.category });
    }

    if (filters.priceMin) {
      queryBuilder.andWhere('door.price >= :priceMin', { priceMin: filters.priceMin });
    }

    if (filters.priceMax) {
      queryBuilder.andWhere('door.price <= :priceMax', { priceMax: filters.priceMax });
    }

    if (filters.inStock !== undefined) {
      queryBuilder.andWhere('door.inStock = :inStock', { inStock: filters.inStock });
    }

    switch (filters.sort) {
      case 'popular':
        queryBuilder.orderBy('door.views', 'DESC');
        break;
      case 'price_asc':
        queryBuilder.orderBy('door.price', 'ASC');
        break;
      case 'price_desc':
        queryBuilder.orderBy('door.price', 'DESC');
        break;
      case 'new':
        queryBuilder.orderBy('door.createdAt', 'DESC');
        break;
      default:
        queryBuilder.orderBy('door.createdAt', 'DESC');
    }

    try {
      const doors = await queryBuilder.getMany();
      this.logger.log(`Found ${doors.length} doors`);
      return doors;
    } catch (error) {
      this.logger.error(`Error finding doors: ${error.message}`);
      throw error;
    }
  }

  async findOne(id: string): Promise<Door> {
    this.logger.log(`Finding door with id: ${id}`);
    
    // Try to get from cache first
    const cacheKey = `door:${id}`;
    this.logger.log(`Checking cache with key: ${cacheKey}`);
    const cachedDoor = await this.redisService.get(cacheKey);
    
    if (cachedDoor) {
      this.logger.log(`Found cached door with id: ${id}`);
      return JSON.parse(cachedDoor);
    }

    this.logger.log(`No cached door found, querying database for id: ${id}`);
    try {
      const door = await this.doorRepository.findOne({
        where: { id },
        relations: ['category']
      });
      
      if (!door) {
        this.logger.warn(`Door with id ${id} not found in database`);
        throw new NotFoundException(`Door with id ${id} not found`);
      }

      this.logger.log(`Found door in database: ${JSON.stringify(door)}`);

      // Cache the result
      await this.redisService.set(cacheKey, JSON.stringify(door));
      this.logger.log(`Cached door with id: ${id}`);

      return door;
    } catch (error) {
      this.logger.error(`Error finding door with id ${id}: ${error.message}`);
      this.logger.error(error.stack);
      throw error;
    }
  }

  async findSimilar(id: string): Promise<Door[]> {
    this.logger.log(`Finding similar doors for id: ${id}`);
    
    // Try to get from cache first
    const cacheKey = `similar:${id}`;
    const cachedDoors = await this.redisService.get(cacheKey);
    
    if (cachedDoors) {
      this.logger.log(`Found cached similar doors for id: ${id}`);
      return JSON.parse(cachedDoors);
    }

    // Get the original door first
    const door = await this.findOne(id);
    if (!door) {
      return [];
    }

    // Find doors in the same category with similar price range (±20%)
    const minPrice = door.price * 0.8;
    const maxPrice = door.price * 1.2;

    const queryBuilder = this.doorRepository.createQueryBuilder('door')
      .where('door.id != :id', { id })
      .andWhere('door.categoryId = :categoryId', { categoryId: door.categoryId })
      .andWhere('door.price BETWEEN :minPrice AND :maxPrice', { minPrice, maxPrice })
      .orderBy('RANDOM()')
      .take(4);

    const similarDoors = await queryBuilder.getMany();
    
    // Cache the result
    await this.redisService.set(cacheKey, JSON.stringify(similarDoors));
    this.logger.log(`Cached similar doors for id: ${id}`);

    return similarDoors;
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
        where: { categoryId: await this.getCategoryId(category) },
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
        queryBuilder.where('door.categoryId = :categoryId', { categoryId: await this.getCategoryId(category) });
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

  private async getCategoryId(categoryName: string): Promise<number> {
    const category = await this.categoryRepository.findOne({
      where: { name: categoryName }
    });
    
    if (!category) {
      throw new NotFoundException(`Category ${categoryName} not found`);
    }
    
    return category.id;
  }
} 