import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Door } from './src/parsers/farniture/entities/door.entity';
import { Category } from './src/categories/entities/category.entity';
import { User } from './src/users/entities/user.entity';
import { Order } from './src/orders/entities/order.entity';
import { CreateTables1710000000000 } from './src/migrations/1710000000000-CreateTables';
import { CreateOrders1710367200000 } from './src/migrations/1710367200000-CreateOrders';
import { CreateDoorsTable1710424800000 } from './src/migrations/1710424800000-CreateDoorsTable';
import { AddImageUrlsArray1710424800001 } from './src/migrations/1710424800001-AddImageUrlsArray';
import { AddDoorDetails1710424800002 } from './src/migrations/1710424800002-AddDoorDetails';
import { CreateOrdersTable1710500000000 } from './src/migrations/1710500000000-CreateOrdersTable';
import { UpdateUserPasswords1710587682123 } from './src/migrations/UpdateUserPasswords';
import { AddNewDoorFields1710510000000 } from './src/migrations/1710510000000-AddNewDoorFields';

config(); // Загружаем переменные окружения

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'doors_repair',
  entities: [Door, Category, User, Order],
  migrations: [
    CreateTables1710000000000,
    CreateOrders1710367200000,
    CreateDoorsTable1710424800000,
    AddImageUrlsArray1710424800001,
    AddDoorDetails1710424800002,
    CreateOrdersTable1710500000000,
    UpdateUserPasswords1710587682123,
    AddNewDoorFields1710510000000
  ],
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});

export default dataSource; 