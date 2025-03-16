import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Category } from '../categories/entities/category.entity';
import { User } from '../users/entities/user.entity';

// Загружаем переменные окружения
config();

const categories = [
  { name: 'Премиум', description: 'Премиум категория дверей' },
  { name: 'Стандарт', description: 'Стандартная категория дверей' },
  { name: 'Эконом', description: 'Эконом категория дверей' },
];

const adminUser = {
  email: 'admin@expample.com',
  password: require('crypto').createHash('sha256').update('admin123').digest('hex'),
  isAdmin: true,
};

async function seed(dataSource: DataSource) {
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
}

async function main() {
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

  try {
    await dataSource.initialize();
    await seed(dataSource);
    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Ошибка при заполнении базы данных:', error);
    process.exit(1);
  }
}

main(); 