import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateDoorCategory1710700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование колонки category_id
    const hasColumn = await queryRunner.hasColumn('doors', 'category_id');
    if (!hasColumn) {
      // Добавляем поле category_id только если его нет
      await queryRunner.query(`
        ALTER TABLE doors 
        ADD COLUMN category_id integer;
      `);
    }

    // Создаем связи с категориями на основе существующих значений
    await queryRunner.query(`
      UPDATE doors d
      SET category_id = c.id
      FROM categories c
      WHERE LOWER(d.category) = LOWER(c.name);
    `);

    // Проверяем существование внешнего ключа
    const table = await queryRunner.getTable('doors');
    const foreignKey = table?.foreignKeys.find(fk => fk.columnNames.indexOf('category_id') !== -1);
    
    if (!foreignKey) {
      // Добавляем внешний ключ только если его нет
      await queryRunner.query(`
        ALTER TABLE doors
        ADD CONSTRAINT fk_door_category
        FOREIGN KEY (category_id)
        REFERENCES categories(id);
      `);
    }

    // Проверяем существование колонки category перед удалением
    const hasCategoryColumn = await queryRunner.hasColumn('doors', 'category');
    if (hasCategoryColumn) {
      // Удаляем старое поле category только если оно существует
      await queryRunner.query(`
        ALTER TABLE doors
        DROP COLUMN category;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование колонки category
    const hasCategoryColumn = await queryRunner.hasColumn('doors', 'category');
    if (!hasCategoryColumn) {
      // Добавляем поле category обратно только если его нет
      await queryRunner.query(`
        ALTER TABLE doors
        ADD COLUMN category varchar;
      `);
    }

    // Восстанавливаем значения из связей
    await queryRunner.query(`
      UPDATE doors d
      SET category = c.name
      FROM categories c
      WHERE d.category_id = c.id;
    `);

    // Проверяем существование внешнего ключа
    const table = await queryRunner.getTable('doors');
    const foreignKey = table?.foreignKeys.find(fk => fk.columnNames.indexOf('category_id') !== -1);
    
    if (foreignKey) {
      // Удаляем внешний ключ только если он существует
      await queryRunner.query(`
        ALTER TABLE doors
        DROP CONSTRAINT fk_door_category;
      `);
    }

    // Проверяем существование колонки category_id
    const hasColumn = await queryRunner.hasColumn('doors', 'category_id');
    if (hasColumn) {
      // Удаляем поле category_id только если оно существует
      await queryRunner.query(`
        ALTER TABLE doors
        DROP COLUMN category_id;
      `);
    }
  }
} 