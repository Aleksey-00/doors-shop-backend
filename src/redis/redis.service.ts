import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private readonly logger = new Logger(RedisService.name);
  private redisEnabled: boolean;

  async onModuleInit() {
    this.redisEnabled = process.env.REDIS_ENABLED !== 'false';
    
    if (!this.redisEnabled) {
      this.logger.warn('Redis is disabled by environment variable REDIS_ENABLED=false');
      return;
    }
    
    try {
      // Проверяем наличие REDIS_URL
      if (process.env.REDIS_URL) {
        this.logger.log(`Connecting to Redis using URL: ${process.env.REDIS_URL.replace(/\/\/.*:(.*)@/, '//***:***@')}`);
        this.client = new Redis(process.env.REDIS_URL);
      } else {
        // Используем отдельные параметры подключения
        const host = process.env.REDIS_HOST || 'localhost';
        const port = parseInt(process.env.REDIS_PORT || '6379');
        this.logger.log(`Connecting to Redis using host: ${host}, port: ${port}`);
        this.client = new Redis({
          host,
          port,
        });
      }
      
      // Проверяем подключение
      await this.client.ping();
      this.logger.log('Successfully connected to Redis');
    } catch (error) {
      this.logger.error(`Failed to connect to Redis: ${error.message}`);
      this.redisEnabled = false;
    }
  }

  async onModuleDestroy() {
    if (this.redisEnabled && this.client) {
      await this.client.quit();
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.redisEnabled) {
      return null;
    }
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.redisEnabled) {
      return;
    }
    
    if (ttl) {
      await this.client.set(key, value, 'EX', ttl);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string | string[]): Promise<void> {
    if (!this.redisEnabled) {
      return;
    }
    if (Array.isArray(key)) {
      await this.client.del(...key);
    } else {
      await this.client.del(key);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.redisEnabled) {
      return [];
    }
    return await this.client.keys(pattern);
  }
} 