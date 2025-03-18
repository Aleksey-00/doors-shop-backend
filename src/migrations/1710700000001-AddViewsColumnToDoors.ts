import { MigrationInterface, QueryRunner } from "typeorm";

export class AddViewsColumnToDoors1710700000001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Добавляем колонку views со значением по умолчанию 0
        await queryRunner.query(`
            ALTER TABLE doors
            ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Удаляем колонку views при откате миграции
        await queryRunner.query(`
            ALTER TABLE doors
            DROP COLUMN IF EXISTS views
        `);
    }
} 