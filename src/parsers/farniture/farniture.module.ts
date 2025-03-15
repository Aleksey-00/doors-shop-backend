import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { FarnitureService } from './farniture.service';
import { FarnitureController } from './farniture.controller';
import { Door } from './entities/door.entity';
import { RedisModule } from '../../redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Door]),
    ScheduleModule.forRoot(),
    RedisModule,
  ],
  providers: [FarnitureService],
  controllers: [FarnitureController],
  exports: [FarnitureService],
})
export class FarnitureModule {}
