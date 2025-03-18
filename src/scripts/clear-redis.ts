import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RedisService } from '../redis/redis.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('RedisClear');
  logger.log('Starting Redis clearing...');

  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const redisService = app.get(RedisService);

    // Проверяем подключение к Redis
    try {
      await redisService['client'].ping();
      logger.log('Successfully connected to Redis');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error.message);
      process.exit(1);
    }

    // Получаем все ключи
    const keys = await redisService.keys('*');
    logger.log(`Found ${keys.length} keys in Redis`);

    // Удаляем все ключи
    if (keys.length > 0) {
      await redisService.del(keys);
      logger.log(`Successfully deleted ${keys.length} keys from Redis`);
    } else {
      logger.log('No keys to delete');
    }

    await app.close();
    logger.log('Redis clearing completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during Redis clearing:', error);
    process.exit(1);
  }
}

bootstrap(); 