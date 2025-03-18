import { MigrationInterface, QueryRunner } from "typeorm";

export class FixPriceUnit1710700000003 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Удаляем триггер
        await queryRunner.query(`
            DROP TRIGGER IF EXISTS update_category_trigger ON doors;
        `);

        // Обновляем NULL значения на значение по умолчанию
        await queryRunner.query(`
            UPDATE doors 
            SET price_unit = '₽' 
            WHERE price_unit IS NULL
        `);

        // Устанавливаем значение по умолчанию для новых записей
        await queryRunner.query(`
            ALTER TABLE doors 
            ALTER COLUMN price_unit SET DEFAULT '₽'
        `);

        // Восстанавливаем триггер
        await queryRunner.query(`
            CREATE TRIGGER update_category_trigger
            BEFORE INSERT OR UPDATE ON doors
            FOR EACH ROW
            EXECUTE FUNCTION update_category();
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Удаляем триггер
        await queryRunner.query(`
            DROP TRIGGER IF EXISTS update_category_trigger ON doors;
        `);

        // Возвращаем колонку в исходное состояние
        await queryRunner.query(`
            ALTER TABLE doors 
            ALTER COLUMN price_unit DROP DEFAULT
        `);

        // Восстанавливаем триггер
        await queryRunner.query(`
            CREATE TRIGGER update_category_trigger
            BEFORE INSERT OR UPDATE ON doors
            FOR EACH ROW
            EXECUTE FUNCTION update_category();
        `);
    }
} 