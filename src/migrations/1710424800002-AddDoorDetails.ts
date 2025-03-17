import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDoorDetails1710424800002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Добавляем новые колонки для размеров
    await queryRunner.query(`
      ALTER TABLE doors
      ADD COLUMN IF NOT EXISTS dimensions jsonb,
      ADD COLUMN IF NOT EXISTS materials jsonb,
      ADD COLUMN IF NOT EXISTS equipment text[],
      ADD COLUMN IF NOT EXISTS features text[],
      ADD COLUMN IF NOT EXISTS manufacturer varchar,
      ADD COLUMN IF NOT EXISTS warranty varchar,
      ADD COLUMN IF NOT EXISTS installation jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем добавленные колонки
    await queryRunner.query(`
      ALTER TABLE doors
      DROP COLUMN IF EXISTS dimensions,
      DROP COLUMN IF EXISTS materials,
      DROP COLUMN IF EXISTS equipment,
      DROP COLUMN IF EXISTS features,
      DROP COLUMN IF EXISTS manufacturer,
      DROP COLUMN IF EXISTS warranty,
      DROP COLUMN IF EXISTS installation;
    `);
  }
} 