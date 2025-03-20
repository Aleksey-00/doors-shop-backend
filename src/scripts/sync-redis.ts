import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Door } from '../doors/entities/door.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RedisService } from '../redis/redis.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('RedisSync');
  logger.log('Starting Redis synchronization...');

  try {
    logger.log('Redis URL:', process.env.REDIS_URL?.replace(/\/\/.*:(.*)@/, '//***:***@'));
    logger.log('Redis Enabled:', process.env.REDIS_ENABLED);

    const app = await NestFactory.createApplicationContext(AppModule);
    const doorRepository = app.get<Repository<Door>>(getRepositoryToken(Door));
    const redisService = app.get(RedisService);

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