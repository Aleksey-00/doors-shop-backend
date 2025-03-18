import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateDoorCategory1710700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Добавляем временное поле для хранения старых значений
    await queryRunner.query(`
      ALTER TABLE doors 
      ADD COLUMN category_id integer;
    `);

    // Создаем связи с категориями на основе существующих значений
    await queryRunner.query(`
      UPDATE doors d
      SET category_id = c.id
      FROM categories c
      WHERE LOWER(d.category) = LOWER(c.name);
    `);

    // Добавляем внешний ключ
    await queryRunner.query(`
      ALTER TABLE doors
      ADD CONSTRAINT fk_door_category
      FOREIGN KEY (category_id)
      REFERENCES categories(id);
    `);

    // Удаляем старое поле category
    await queryRunner.query(`
      ALTER TABLE doors
      DROP COLUMN category;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Добавляем поле category обратно
    await queryRunner.query(`
      ALTER TABLE doors
      ADD COLUMN category varchar;
    `);

    // Восстанавливаем значения из связей
    await queryRunner.query(`
      UPDATE doors d
      SET category = c.name
      FROM categories c
      WHERE d.category_id = c.id;
    `);

    // Удаляем внешний ключ и поле category_id
    await queryRunner.query(`
      ALTER TABLE doors
      DROP CONSTRAINT fk_door_category;
    `);

    await queryRunner.query(`
      ALTER TABLE doors
      DROP COLUMN category_id;
    `);
  }
} 