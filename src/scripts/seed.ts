import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { Category } from '../categories/entities/category.entity';
import { User } from '../users/entities/user.entity';

const categories = [
  { name: 'Премиум', description: 'Премиум категория дверей' },
  { name: 'Стандарт', description: 'Стандартная категория дверей' },
  { name: 'Эконом', description: 'Эконом категория дверей' },
];

const adminUser = {
  email: 'admin@expample.com',
  password: crypto.createHash('sha256').update('admin123').digest('hex'),
  isAdmin: true,
};

export const seed = async (dataSource: DataSource) => {
  try {
    // Проверяем существование категорий
    const existingCategories = await dataSource.getRepository(Category).find();
    if (existingCategories.length === 0) {
      console.log('Добавление категорий...');
      await dataSource
        .createQueryBuilder()
        .insert()
        .into(Category)
        .values(categories)
        .execute();
      console.log('Категории успешно добавлены');
    } else {
      console.log('Категории уже существуют, пропускаем...');
    }

    // Проверяем существование админа
    const existingAdmin = await dataSource
      .getRepository(User)
      .findOne({ where: { email: adminUser.email } });

    if (!existingAdmin) {
      console.log('Добавление администратора...');
      await dataSource
        .createQueryBuilder()
        .insert()
        .into(User)
        .values([adminUser])
        .execute();
      console.log('Администратор успешно добавлен');
    } else {
      console.log('Администратор уже существует, пропускаем...');
    }

    console.log('Заполнение базы данных завершено успешно');
  } catch (error) {
    console.error('Ошибка при заполнении базы данных:', error);
    throw error;
  }
}; 