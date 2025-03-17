import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNewDoorFields1710510000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Добавляем новые поля для цен
    await queryRunner.query(`ALTER TABLE "doors" ADD COLUMN IF NOT EXISTS "priceUnit" character varying`);

    // Добавляем поле для миниатюр
    await queryRunner.query(`ALTER TABLE "doors" ADD COLUMN IF NOT EXISTS "thumbnailUrls" text[]`);

    // Добавляем поле для акций
    await queryRunner.query(`ALTER TABLE "doors" ADD COLUMN IF NOT EXISTS "sale" jsonb`);

    // Добавляем поля для характеристик дверей
    await queryRunner.query(`ALTER TABLE "doors" ADD COLUMN IF NOT EXISTS "lockCount" integer`);
    await queryRunner.query(`ALTER TABLE "doors" ADD COLUMN IF NOT EXISTS "metalThickness" real`);
    await queryRunner.query(`ALTER TABLE "doors" ADD COLUMN IF NOT EXISTS "doorThickness" integer`);
    await queryRunner.query(`ALTER TABLE "doors" ADD COLUMN IF NOT EXISTS "exteriorFinish" character varying`);
    await queryRunner.query(`ALTER TABLE "doors" ADD COLUMN IF NOT EXISTS "interiorFinish" character varying`);
    await queryRunner.query(`ALTER TABLE "doors" ADD COLUMN IF NOT EXISTS "exteriorColor" character varying`);
    await queryRunner.query(`ALTER TABLE "doors" ADD COLUMN IF NOT EXISTS "interiorColor" character varying`);
    await queryRunner.query(`ALTER TABLE "doors" ADD COLUMN IF NOT EXISTS "sizes" text[]`);
    await queryRunner.query(`ALTER TABLE "doors" ADD COLUMN IF NOT EXISTS "country" character varying`);

    // Добавляем поля для бренда и рейтинга
    await queryRunner.query(`ALTER TABLE "doors" ADD COLUMN IF NOT EXISTS "brand" jsonb`);
    await queryRunner.query(`ALTER TABLE "doors" ADD COLUMN IF NOT EXISTS "rating" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем поля для цен
    await queryRunner.query(`ALTER TABLE "doors" DROP COLUMN IF EXISTS "priceUnit"`);

    // Удаляем поле для миниатюр
    await queryRunner.query(`ALTER TABLE "doors" DROP COLUMN IF EXISTS "thumbnailUrls"`);

    // Удаляем поле для акций
    await queryRunner.query(`ALTER TABLE "doors" DROP COLUMN IF EXISTS "sale"`);

    // Удаляем поля для характеристик дверей
    await queryRunner.query(`ALTER TABLE "doors" DROP COLUMN IF EXISTS "lockCount"`);
    await queryRunner.query(`ALTER TABLE "doors" DROP COLUMN IF EXISTS "metalThickness"`);
    await queryRunner.query(`ALTER TABLE "doors" DROP COLUMN IF EXISTS "doorThickness"`);
    await queryRunner.query(`ALTER TABLE "doors" DROP COLUMN IF EXISTS "exteriorFinish"`);
    await queryRunner.query(`ALTER TABLE "doors" DROP COLUMN IF EXISTS "interiorFinish"`);
    await queryRunner.query(`ALTER TABLE "doors" DROP COLUMN IF EXISTS "exteriorColor"`);
    await queryRunner.query(`ALTER TABLE "doors" DROP COLUMN IF EXISTS "interiorColor"`);
    await queryRunner.query(`ALTER TABLE "doors" DROP COLUMN IF EXISTS "sizes"`);
    await queryRunner.query(`ALTER TABLE "doors" DROP COLUMN IF EXISTS "country"`);

    // Удаляем поля для бренда и рейтинга
    await queryRunner.query(`ALTER TABLE "doors" DROP COLUMN IF EXISTS "brand"`);
    await queryRunner.query(`ALTER TABLE "doors" DROP COLUMN IF EXISTS "rating"`);
  }
} 