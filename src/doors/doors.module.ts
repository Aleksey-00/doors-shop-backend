import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { DoorsController } from './doors.controller';
import { DoorsService } from './doors.service';
import { Door } from '../parsers/farniture/entities/door.entity';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Door]),
    PassportModule,
    AuthModule,
    RedisModule,
  ],
  controllers: [DoorsController],
  providers: [DoorsService],
  exports: [TypeOrmModule, DoorsService],
})
export class DoorsModule {} 