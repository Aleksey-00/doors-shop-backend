import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoorsModule } from './doors/doors.module';
import { OrdersModule } from './orders/orders.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ParsersModule } from './parsers/parsers.module';
import { CategoriesModule } from './categories/categories.module';
import './polyfills';
import { RequestsModule } from './requests/requests.module';
import { BullModule } from '@nestjs/bull';
import { RedisModule } from './redis/redis.module';
import { User } from './users/entities/user.entity';
import { Door } from './doors/entities/door.entity';
import { Category } from './categories/entities/category.entity';
import { Order } from './orders/entities/order.entity';
import { validate } from './config/env.validation';
import * as path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: path.resolve(process.cwd(), '.env'),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        entities: [User, Door, Category, Order],
        synchronize: configService.get('TYPEORM_SYNCHRONIZE'),
        logging: configService.get('TYPEORM_LOGGING'),
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    DoorsModule,
    OrdersModule,
    AuthModule,
    UsersModule,
    ParsersModule,
    CategoriesModule,
    RequestsModule,
    RedisModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {} 