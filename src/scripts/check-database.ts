import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('DatabaseCheck');
  logger.log('Starting database check...');

  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const dataSource = app.get(DataSource);

    // Проверяем подключение к базе данных
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    // Проверяем существование таблицы doors
    const tableExists = await dataSource.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'doors')"
    );

    if (!tableExists[0].exists) {
      logger.log('Table doors does not exist. Creating...');
      await dataSource.runMigrations();
    } else {
      // Проверяем структуру таблицы
      const columns = await dataSource.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'doors'
      `);

      logger.log('Current table structure:', columns);

      // Проверяем наличие всех необходимых колонок
      const requiredColumns = [
        { name: 'id', type: 'uuid' },
        { name: 'title', type: 'character varying' },
        { name: 'price', type: 'integer' },
        { name: 'old_price', type: 'integer' },
        { name: 'category', type: 'character varying' },
        { name: 'image_url', type: 'character varying' },
        { name: 'in_stock', type: 'boolean' },
        { name: 'description', type: 'text' },
        { name: 'specifications', type: 'jsonb' },
        { name: 'url', type: 'character varying' },
        { name: 'external_id', type: 'character varying' },
        { name: 'created_at', type: 'timestamp without time zone' },
        { name: 'updated_at', type: 'timestamp without time zone' },
      ];

      const missingColumns = requiredColumns.filter(
        required => !columns.some(col => col.column_name === required.name)
      );

      if (missingColumns.length > 0) {
        logger.log('Missing columns:', missingColumns);
        logger.log('Recreating table...');
        
        // Удаляем существующую таблицу
        await dataSource.query('DROP TABLE IF EXISTS doors CASCADE');
        
        // Запускаем миграции заново
        await dataSource.runMigrations();
      }
    }

    logger.log('Database check completed successfully');
    await app.close();
  } catch (error) {
    logger.error('Error during database check:', error);
    process.exit(1);
  }
}

bootstrap(); 