import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTables1710000000000 implements MigrationInterface {
    name = 'CreateTables1710000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "categories" (
                "id" SERIAL PRIMARY KEY,
                "name" character varying NOT NULL,
                "description" character varying,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "doors" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "title" character varying NOT NULL,
                "price" numeric NOT NULL,
                "old_price" numeric,
                "category" character varying NOT NULL,
                "image_urls" text[] DEFAULT '{}',
                "in_stock" boolean NOT NULL DEFAULT true,
                "description" text,
                "specifications" jsonb,
                "url" character varying NOT NULL,
                "external_id" character varying NOT NULL UNIQUE,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);

        // Add some test data
        await queryRunner.query(`
            INSERT INTO categories (name, description)
            VALUES 
                ('Премиум', 'Премиальные входные двери высшего качества'),
                ('Стандарт', 'Стандартные входные двери хорошего качества'),
                ('Эконом', 'Экономичные входные двери')
            ON CONFLICT DO NOTHING
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "doors"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "categories"`);
    }
} 