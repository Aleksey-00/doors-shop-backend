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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        console.log('Environment variables:');
        console.log('DATABASE_URL:', configService.get('DATABASE_URL'));
        console.log('DB_HOST:', configService.get('DB_HOST'));
        console.log('DB_PORT:', configService.get('DB_PORT'));
        console.log('DB_USERNAME:', configService.get('DB_USERNAME'));
        console.log('DB_PASSWORD:', configService.get('DB_PASSWORD') ? '[REDACTED]' : undefined);
        console.log('DB_NAME:', configService.get('DB_NAME'));
        console.log('NODE_ENV:', configService.get('NODE_ENV'));
        
        // Проверяем, запущено ли приложение на Railway
        const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production' || 
                          process.env.RAILWAY_PROJECT_ID || 
                          process.env.RAILWAY_SERVICE_ID;
        
        const databaseUrl = configService.get('DATABASE_URL');
        
        if (databaseUrl) {
          // Используем URL-строку подключения, если она предоставлена
          console.log('Using DATABASE_URL for connection');
          return {
            type: 'postgres',
            url: databaseUrl,
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: true, // Всегда создаем таблицы, даже в production
            ssl: { rejectUnauthorized: false },
            logging: true, // Включаем логирование SQL-запросов
            extra: { 
              // Дополнительные параметры для отладки
              connectionTimeoutMillis: 5000,
              query_timeout: 10000
            }
          };
        } else if (isRailway) {
          // Если мы на Railway, но DATABASE_URL не предоставлен, выводим предупреждение
          console.warn('WARNING: Running on Railway but DATABASE_URL is not provided!');
          console.log('Trying to use individual connection parameters instead');
          
          // Используем отдельные параметры подключения
          return {
            type: 'postgres',
            host: configService.get('DB_HOST') || 'localhost',
            port: +(configService.get('DB_PORT') || 5432),
            username: configService.get('DB_USERNAME') || 'postgres',
            password: configService.get('DB_PASSWORD') || 'postgres',
            database: configService.get('DB_NAME') || 'doors_repair',
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: true, // Всегда создаем таблицы, даже в production
            ssl: { rejectUnauthorized: false },
            logging: true,
            extra: { 
              connectionTimeoutMillis: 5000,
              query_timeout: 10000
            }
          };
        }
        
        // Иначе используем отдельные параметры подключения
        console.log('Using individual connection parameters');
        return {
          type: 'postgres',
          host: configService.get('DB_HOST') || 'localhost',
          port: +(configService.get('DB_PORT') || 5432),
          username: configService.get('DB_USERNAME') || 'postgres',
          password: configService.get('DB_PASSWORD') || 'postgres',
          database: configService.get('DB_NAME') || 'doors_repair',
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: true, // Всегда создаем таблицы, даже в production
          logging: true, // Включаем логирование SQL-запросов
          ssl: configService.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
          extra: { 
            // Дополнительные параметры для отладки
            connectionTimeoutMillis: 5000,
            query_timeout: 10000
          }
        };
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
  ],
})
export class AppModule {} 