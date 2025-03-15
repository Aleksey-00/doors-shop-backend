import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageUrlsArray1710424800001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Сначала создаем новую колонку
    await queryRunner.query(`
      ALTER TABLE doors 
      ADD COLUMN "imageUrls" text[] NULL;
    `);

    // Переносим данные из старой колонки в новую
    await queryRunner.query(`
      UPDATE doors 
      SET "imageUrls" = ARRAY["imageUrl"]
      WHERE "imageUrl" IS NOT NULL;
    `);

    // Удаляем старую колонку
    await queryRunner.query(`
      ALTER TABLE doors 
      DROP COLUMN "imageUrl";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Восстанавливаем старую структуру
    await queryRunner.query(`
      ALTER TABLE doors 
      ADD COLUMN "imageUrl" varchar NULL;
    `);

    // Переносим первое изображение обратно
    await queryRunner.query(`
      UPDATE doors 
      SET "imageUrl" = "imageUrls"[1]
      WHERE "imageUrls" IS NOT NULL;
    `);

    // Удаляем новую колонку
    await queryRunner.query(`
      ALTER TABLE doors 
      DROP COLUMN "imageUrls";
    `);
  }
} 