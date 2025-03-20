import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { DoorsController } from './doors.controller';
import { DoorsService } from './doors.service';
import { Door } from './entities/door.entity';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { Category } from '../categories/entities/category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Door]),
    PassportModule,
    AuthModule,
    RedisModule,
  ],
  controllers: [DoorsController],
  providers: [
    DoorsService,
    {
      provide: Logger,
      useValue: new Logger(DoorsModule.name),
    },
  ],
  exports: [DoorsService],
})
export class DoorsModule {} 