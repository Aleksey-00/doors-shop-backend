import { DataSource } from 'typeorm';
import { seed } from './seed';
import { config } from 'dotenv';
import { Category } from '../categories/entities/category.entity';
import { User } from '../users/entities/user.entity';
import { join } from 'path';

// Загружаем переменные окружения
config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || process.env.DB_NAME,
  entities: [Category, User],
  synchronize: false,
});

const runSeed = async () => {
  try {
    await dataSource.initialize();
    await seed(dataSource);
    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Ошибка при заполнении базы данных:', error);
    process.exit(1);
  }
};

runSeed(); 