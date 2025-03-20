import { Module, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

@Module({
  providers: [
    RedisService,
    {
      provide: Logger,
      useValue: new Logger(RedisModule.name),
    },
  ],
  exports: [RedisService],
})
export class RedisModule {} 