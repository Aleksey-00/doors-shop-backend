import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateCategoryDescriptions1710700000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE categories 
      SET description = CASE name
        WHEN 'Премиум' THEN 'Премиальные входные двери высшего качества. Изготовлены из высококачественных материалов, имеют усиленную защиту от взлома, современный дизайн и длительный срок службы. Идеальный выбор для тех, кто ценит безопасность, комфорт и эстетику.'
        WHEN 'Стандарт' THEN 'Стандартные входные двери хорошего качества. Оптимальное соотношение цены и качества. Имеют базовую защиту от взлома, хорошую теплоизоляцию и современный дизайн. Подходят для большинства жилых помещений.'
        WHEN 'Эконом' THEN 'Экономичные входные двери. Базовый уровень защиты и теплоизоляции. Идеальный выбор для дач, подсобных помещений или временного использования. Хорошее соотношение цены и функциональности.'
      END
      WHERE name IN ('Премиум', 'Стандарт', 'Эконом');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE categories 
      SET description = CASE name
        WHEN 'Премиум' THEN 'Премиум категория дверей'
        WHEN 'Стандарт' THEN 'Стандартная категория дверей'
        WHEN 'Эконом' THEN 'Эконом категория дверей'
      END
      WHERE name IN ('Премиум', 'Стандарт', 'Эконом');
    `);
  }
} 