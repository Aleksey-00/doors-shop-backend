import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Door } from '../doors/entities/door.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RedisService } from '../redis/redis.service';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const logger = new Logger('RedisSync');
  logger.log('Starting Redis synchronization...');

  try {
    logger.log('Redis URL:', process.env.REDIS_URL?.replace(/\/\/.*:(.*)@/, '//***:***@'));
    logger.log('Redis Enabled:', process.env.REDIS_ENABLED);

    const app = await NestFactory.createApplicationContext(AppModule);
    const dataSource = app.get(DataSource);
    const doorRepository = app.get<Repository<Door>>(getRepositoryToken(Door));
    const redisService = app.get(RedisService);

    // Проверяем подключение к базе данных
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    // Проверяем структуру таблицы doors
    const columns = await dataSource.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'doors'
    `);

    logger.log('Current table structure:', columns);

    // Проверяем наличие всех необходимых колонок
    const requiredColumns = [
      { name: 'id', type: 'uuid' },
      { name: 'title', type: 'character varying' },
      { name: 'price', type: 'integer' },
      { name: 'old_price', type: 'integer' },
      { name: 'category', type: 'character varying' },
      { name: 'image_url', type: 'character varying' },
      { name: 'in_stock', type: 'boolean' },
      { name: 'description', type: 'text' },
      { name: 'specifications', type: 'jsonb' },
      { name: 'url', type: 'character varying' },
      { name: 'external_id', type: 'character varying' },
      { name: 'created_at', type: 'timestamp without time zone' },
      { name: 'updated_at', type: 'timestamp without time zone' },
    ];

    const missingColumns = requiredColumns.filter(
      required => !columns.some(col => col.column_name === required.name)
    );

    if (missingColumns.length > 0) {
      logger.log('Missing columns:', missingColumns);
      logger.log('Recreating table...');
      
      // Удаляем существующую таблицу
      await dataSource.query('DROP TABLE IF EXISTS doors CASCADE');
      
      // Запускаем миграции заново
      await dataSource.runMigrations();
    }

    // Проверяем подключение к Redis
    try {
      await redisService['client'].ping();
      logger.log('Successfully connected to Redis');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error.message);
      process.exit(1);
    }

    // Проверяем количество дверей в базе данных
    const doorsInDb = await doorRepository.count();
    logger.log(`Found ${doorsInDb} doors in database`);

    // Проверяем количество дверей в Redis
    const redisKeys = await redisService.keys('door:*');
    const doorsInRedis = redisKeys.length;
    logger.log(`Found ${doorsInRedis} doors in Redis`);

    // Если количество совпадает, проверяем содержимое
    if (doorsInDb === doorsInRedis && doorsInRedis > 0) {
      logger.log('Количество дверей в базе данных и Redis совпадает. Проверяем содержимое...');
      
      // Выборочная проверка нескольких записей
      const doors = await doorRepository.find({ take: 5 });
      let allMatch = true;

      for (const door of doors) {
        const redisData = await redisService.get(`door:${door.id}`);
        if (!redisData) {
          allMatch = false;
          break;
        }
      }

      if (allMatch) {
        logger.log('Данные в Redis актуальны. Синхронизация не требуется.');
        await app.close();
        return;
      }
    }

    // Если дошли до этой точки, нужна синхронизация
    logger.log('Начинаем синхронизацию данных...');

    // Очищаем существующие ключи в Redis
    for (const key of redisKeys) {
      await redisService.del(key);
    }

    // Получаем все двери из базы данных
    const allDoors = await doorRepository.find();
    logger.log(`Загружено ${allDoors.length} дверей из базы данных`);

    // Сохраняем двери в Redis
    let syncedCount = 0;
    for (const door of allDoors) {
      await redisService.set(`door:${door.id}`, JSON.stringify(door));
      syncedCount++;

      if (syncedCount % 100 === 0) {
        logger.log(`Синхронизировано ${syncedCount}/${allDoors.length} дверей`);
      }
    }

    logger.log(`Синхронизация завершена. Синхронизировано ${syncedCount} дверей`);
    await app.close();
  } catch (error) {
    logger.error('Ошибка при синхронизации:', error);
    process.exit(1);
  }
}

bootstrap(); 