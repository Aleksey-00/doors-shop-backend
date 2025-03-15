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
      this.client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      });
      
      this.logger.log(`Redis connected to ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`);
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

  async del(key: string): Promise<void> {
    if (!this.redisEnabled) {
      return;
    }
    await this.client.del(key);
  }
} 