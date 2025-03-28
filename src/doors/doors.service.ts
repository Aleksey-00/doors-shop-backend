import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Door } from '../parsers/farniture/entities/door.entity';
import { RedisService } from '../redis/redis.service';
import { In } from 'typeorm';
import { ErrorHandler } from '../utils/error-handler';
import { Category } from '../categories/entities/category.entity';
import * as crypto from 'crypto';

interface FindAllFilters {
  category?: string;
  priceMin?: number;
  priceMax?: number;
  inStock?: boolean;
  sort?: 'popular' | 'price_asc' | 'price_desc' | 'new';
  page?: number;
  limit?: number;
  search?: string;
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

  async findAll(filters: FindAllFilters) {
    try {
      const {
        page = 1,
        limit = 12,
        category,
        search,
        priceMin,
        priceMax,
        inStock,
        sort
      } = filters;

      const queryBuilder = this.doorRepository
        .createQueryBuilder('door')
        .leftJoin('door.category', 'category')
        .select([
          'door.id',
          'door.title',
          'door.price',
          'door.oldPrice',
          'door.imageUrls',
          'door.inStock',
          'door.updatedAt',
          'door.description',
          'door.specifications',
          'door.dimensions',
          'door.materials',
          'door.equipment',
          'door.features',
          'door.manufacturer',
          'door.warranty',
          'door.installation',
          'door.categoryId',
          'door.views',
          'door.createdAt',
          'door.externalId',
          'door.category_name'
        ])
        .where('1=1');

      // Фильтр по категории
      if (category) {
        queryBuilder.andWhere('door.category_name = :category', { category });
      }

      // Фильтр по поиску
      if (search) {
        queryBuilder.andWhere('LOWER(door.title) LIKE LOWER(:search)', { search: `%${search}%` });
      }

      // Фильтр по цене
      if (priceMin !== undefined) {
        queryBuilder.andWhere('door.price >= :priceMin', { priceMin });
      }
      if (priceMax !== undefined) {
        queryBuilder.andWhere('door.price <= :priceMax', { priceMax });
      }

      // Фильтр по наличию
      if (inStock !== undefined) {
        queryBuilder.andWhere('door.inStock = :inStock', { inStock });
      }

      // Сортировка
      if (sort) {
        switch (sort) {
          case 'price_asc':
            queryBuilder.orderBy('door.price', 'ASC');
            break;
          case 'price_desc':
            queryBuilder.orderBy('door.price', 'DESC');
            break;
          case 'popular':
            queryBuilder.orderBy('door.views', 'DESC');
            break;
          case 'new':
            queryBuilder.orderBy('door.createdAt', 'DESC');
            break;
          default:
            queryBuilder.orderBy('door.createdAt', 'DESC');
        }
      } else {
        queryBuilder.orderBy('door.createdAt', 'DESC');
      }

      // Получаем общее количество дверей
      const totalDoors = await queryBuilder.getCount();

      // Применяем пагинацию
      queryBuilder.skip((page - 1) * limit).take(limit);

      // Получаем двери с пагинацией
      const doors = await queryBuilder.getMany();

      // Вычисляем общее количество страниц
      const totalPages = Math.ceil(totalDoors / limit);

      return {
        doors,
        totalPages,
        currentPage: page,
        totalDoors,
      };
    } catch (error) {
      this.logger.error('Error in findAll:', error);
      throw new Error('Failed to fetch doors');
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
      // Увеличиваем счетчик просмотров асинхронно, не ждем завершения
      this.incrementViews(id).catch(err => 
        this.logger.error(`Error incrementing views for door ${id}: ${err.message}`)
      );
      return JSON.parse(cachedDoor);
    }

    this.logger.log(`No cached door found, querying database for id: ${id}`);
    try {
      const door = await this.doorRepository
        .createQueryBuilder('door')
        .select([
          'door.id',
          'door.title',
          'door.price',
          'door.oldPrice',
          'door.imageUrls',
          'door.inStock',
          'door.updatedAt',
          'door.description',
          'door.specifications',
          'door.dimensions',
          'door.materials',
          'door.equipment',
          'door.features',
          'door.manufacturer',
          'door.warranty',
          'door.installation',
          'door.categoryId',
          'door.views',
          'door.createdAt',
          'door.externalId',
          'door.category_name'
        ])
        .where('door.id = :id', { id })
        .getOne();
      
      if (!door) {
        this.logger.warn(`Door with id ${id} not found in database`);
        throw new NotFoundException(`Door with id ${id} not found`);
      }

      this.logger.log(`Found door in database: ${JSON.stringify(door)}`);

      // Добавляем category_name к двери
      const doorWithCategoryName = {
        ...door,
        category_name: door.category_name || ''
      };

      // Увеличиваем счетчик просмотров асинхронно, не ждем завершения
      this.incrementViews(id).catch(err => 
        this.logger.error(`Error incrementing views for door ${id}: ${err.message}`)
      );

      // Cache the result
      await this.redisService.set(cacheKey, JSON.stringify(doorWithCategoryName));
      this.logger.log(`Cached door with id: ${id}`);

      return doorWithCategoryName;
    } catch (error) {
      this.logger.error(`Error finding door with id ${id}: ${error.message}`);
      this.logger.error(error.stack);
      throw error;
    }
  }

  // Метод для увеличения счетчика просмотров двери
  private async incrementViews(id: string): Promise<void> {
    try {
      await this.doorRepository.createQueryBuilder()
        .update(Door)
        .set({ 
          views: () => 'views + 1' 
        })
        .where('id = :id', { id })
        .execute();
      
      this.logger.log(`Incremented views count for door ${id}`);
      
      // Инвалидируем кэш для двери
      const cacheKey = `door:${id}`;
      await this.redisService.del(cacheKey);
    } catch (error) {
      this.logger.error(`Failed to increment views for door ${id}: ${error.message}`);
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
      .leftJoin('door.category', 'category')
      .select([
        'door.id',
        'door.title',
        'door.price',
        'door.oldPrice',
        'door.imageUrls',
        'door.inStock',
        'door.updatedAt',
        'door.description',
        'door.specifications',
        'door.dimensions',
        'door.materials',
        'door.equipment',
        'door.features',
        'door.manufacturer',
        'door.warranty',
        'door.installation',
        'door.categoryId',
        'door.views',
        'door.createdAt',
        'door.externalId',
        'door.category_name'
      ])
      .where('door.id != :id', { id })
      .andWhere('door.categoryId = :categoryId', { categoryId: door.categoryId })
      .andWhere('door.price BETWEEN :minPrice AND :maxPrice', { minPrice, maxPrice })
      .orderBy('RANDOM()')
      .take(4);

    const similarDoors = await queryBuilder.getMany();
    
    // Добавляем category_name к каждой двери
    const similarDoorsWithCategoryName = similarDoors.map(door => ({
      ...door,
      category_name: door.category_name || ''
    }));
    
    // Cache the result
    await this.redisService.set(cacheKey, JSON.stringify(similarDoorsWithCategoryName));
    this.logger.log(`Cached similar doors for id: ${id}`);

    return similarDoorsWithCategoryName;
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
      this.logger.log('Creating new door...');
      const newDoor = this.doorRepository.create(door);
      const savedDoor = await this.doorRepository.save(newDoor);
      
      await this.invalidateCache();
      
      this.logger.log(`Successfully created door with ID ${savedDoor.id}`);
      return savedDoor;
    } catch (error) {
      this.logger.error('Error creating door:', error);
      this.logger.error(error.stack);
      throw error;
    }
  }

  async updateTitlesInCategory(category: string, searchText: string, replaceText: string) {
    try {
      const doors = await this.doorRepository.find({
        where: { category_name: category },
      });

      this.logger.log(`Found ${doors.length} doors in category "${category}" for title update`);

      const updates = doors.map(async (door) => {
        try {
          if (door.title.includes(searchText)) {
            const uuid = crypto.randomUUID().substring(0, 7);
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
        queryBuilder.where('door.category_name = :category', { category });
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