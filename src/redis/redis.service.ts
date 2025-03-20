import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    this.logger.log('Connecting to Redis using URL:', redisUrl.replace(/\/\/.*:(.*)@/, '//***:***@'));
    this.logger.log('Redis Enabled:', this.configService.get('REDIS_ENABLED'));

    this.client = new Redis(redisUrl, {
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('connect', () => {
      this.logger.log('Successfully connected to Redis');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });
  }

  async get(key: string): Promise<string | null> {
    try {
      this.logger.debug(`Getting key: ${key}`);
      const value = await this.client.get(key);
      this.logger.debug(`Got value for key ${key}: ${value ? 'exists' : 'null'}`);
      return value;
    } catch (error) {
      this.logger.error(`Error getting key ${key}:`, error);
      throw error;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      this.logger.debug(`Setting key: ${key}`);
      await this.client.set(key, value);
      this.logger.debug(`Set value for key ${key}`);
    } catch (error) {
      this.logger.error(`Error setting key ${key}:`, error);
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      this.logger.debug(`Deleting key: ${key}`);
      await this.client.del(key);
      this.logger.debug(`Deleted key ${key}`);
    } catch (error) {
      this.logger.error(`Error deleting key ${key}:`, error);
      throw error;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      this.logger.debug(`Getting keys matching pattern: ${pattern}`);
      const keys = await this.client.keys(pattern);
      this.logger.debug(`Found ${keys.length} keys matching pattern ${pattern}`);
      return keys;
    } catch (error) {
      this.logger.error(`Error getting keys matching pattern ${pattern}:`, error);
      throw error;
    }
  }

  async ping(): Promise<string> {
    try {
      this.logger.debug('Pinging Redis...');
      const response = await this.client.ping();
      this.logger.debug('Redis ping response:', response);
      return response;
    } catch (error) {
      this.logger.error('Error pinging Redis:', error);
      throw error;
    }
  }
} 