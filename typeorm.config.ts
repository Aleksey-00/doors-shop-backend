import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Door } from './src/parsers/farniture/entities/door.entity';
import { CreateDoorsTable1710424800000 } from './src/migrations/1710424800000-CreateDoorsTable';

config(); // Загружаем переменные окружения

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'doors_repair',
  entities: [Door],
  migrations: [CreateDoorsTable1710424800000],
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}); 