import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateDoorsTable1710424800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'doors',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'title',
            type: 'varchar',
          },
          {
            name: 'price',
            type: 'integer',
          },
          {
            name: 'oldPrice',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'category',
            type: 'varchar',
          },
          {
            name: 'imageUrl',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'inStock',
            type: 'boolean',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'specifications',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'url',
            type: 'varchar',
          },
          {
            name: 'externalId',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Создаем индексы для оптимизации поиска
    await queryRunner.query(`
      CREATE INDEX doors_category_idx ON doors (category);
      CREATE INDEX doors_external_id_idx ON doors ("externalId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('doors');
  }
} 