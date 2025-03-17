import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageUrlsArray1710424800001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Эта миграция больше не нужна, так как колонка image_urls уже создается в CreateTables1710000000000
    return;
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Ничего не делаем при откате
    return;
  }
} 