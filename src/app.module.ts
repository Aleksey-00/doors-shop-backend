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
        const databaseUrl = configService.get('DATABASE_URL');
        if (databaseUrl) {
          // Используем URL-строку подключения, если она предоставлена
          return {
            type: 'postgres',
            url: databaseUrl,
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: configService.get('NODE_ENV') !== 'production',
            ssl: { rejectUnauthorized: false },
          };
        }
        
        // Иначе используем отдельные параметры подключения
        return {
          type: 'postgres',
          host: configService.get('DB_HOST'),
          port: +configService.get('DB_PORT'),
          username: configService.get('DB_USERNAME'),
          password: configService.get('DB_PASSWORD'),
          database: configService.get('DB_NAME'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: configService.get('NODE_ENV') !== 'production',
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
