import { MigrationInterface, QueryRunner } from "typeorm";

export class RemovePriceNewColumn1710700000003 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE doors
            DROP COLUMN IF EXISTS price_new
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE doors
            ADD COLUMN price_new decimal(10,2)
        `);
    }
} 