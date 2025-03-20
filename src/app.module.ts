import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
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
import { CustomNamingStrategy } from './config/naming-strategy';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService): Promise<TypeOrmModuleOptions> => {
        const logger = new Logger('TypeORM');
        logger.log('Initializing TypeORM connection...');

        try {
          const options: TypeOrmModuleOptions = {
            type: 'postgres',
            host: configService.get('DB_HOST'),
            port: configService.get('DB_PORT'),
            username: configService.get('DB_USERNAME'),
            password: configService.get('DB_PASSWORD'),
            database: configService.get('DB_DATABASE'),
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: false,
            migrations: [__dirname + '/migrations/*{.ts,.js}'],
            migrationsRun: true,
            logging: configService.get('NODE_ENV') === 'development',
            ssl: configService.get('DB_SSL') === 'true' ? {
              rejectUnauthorized: false
            } : false,
            namingStrategy: new CustomNamingStrategy(),
          };

          logger.log('TypeORM options:', {
            ...options,
            password: '***',
          });

          return options;
        } catch (error) {
          logger.error('Failed to initialize TypeORM:', error);
          throw error;
        }
      },
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
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
          password: configService.get('REDIS_PASSWORD'),
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