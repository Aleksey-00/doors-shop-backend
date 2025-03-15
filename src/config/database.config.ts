import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { config } from 'dotenv';
import { User } from '../users/entities/user.entity';
import { Category } from '../categories/entities/category.entity';
import { Door } from '../parsers/farniture/entities/door.entity';

config();

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'doors_repair',
  entities: [User, Category, Door],
  synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true' || process.env.NODE_ENV !== 'production',
  logging: process.env.TYPEORM_LOGGING === 'true' || process.env.NODE_ENV !== 'production',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  migrationsRun: true,
}; 