import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrders1710367200000 implements MigrationInterface {
  name = 'CreateOrders1710367200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование типа перед созданием
    const enumExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type 
        WHERE typname = 'order_status_enum'
      );
    `);

    if (!enumExists[0].exists) {
      await queryRunner.query(`
        CREATE TYPE "order_status_enum" AS ENUM (
          'new',
          'processing',
          'completed',
          'cancelled'
        )
      `);
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "phone" character varying NOT NULL,
        "address" character varying NOT NULL,
        "comment" character varying,
        "items" jsonb NOT NULL,
        "total" decimal(10,2) NOT NULL,
        "status" "order_status_enum" NOT NULL DEFAULT 'new',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "order_status_enum"`);
  }
} 