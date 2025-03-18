import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

export class UpdateExternalIds1710600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Получаем все двери без external_id
    const doors = await queryRunner.query(
      `SELECT id FROM doors WHERE external_id IS NULL`
    );

    // Обновляем каждую дверь, устанавливая уникальный external_id
    for (const door of doors) {
      const externalId = uuidv4();
      await queryRunner.query(
        `UPDATE doors SET external_id = $1 WHERE id = $2`,
        [externalId, door.id]
      );
    }

    // Добавляем ограничение NOT NULL после обновления всех записей
    await queryRunner.query(
      `ALTER TABLE doors ALTER COLUMN external_id SET NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем ограничение NOT NULL
    await queryRunner.query(
      `ALTER TABLE doors ALTER COLUMN external_id DROP NOT NULL`
    );
  }
} 