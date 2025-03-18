import { MigrationInterface, QueryRunner } from "typeorm";

export class FixDoorsPrice1710700000002 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Создаем новую колонку с правильным типом
        await queryRunner.query(`
            ALTER TABLE doors 
            ADD COLUMN price_new decimal(10,2)
        `);

        // Копируем данные из старой колонки в новую
        await queryRunner.query(`
            UPDATE doors 
            SET price_new = price::decimal(10,2)
        `);

        // Обновляем триггер для использования новой колонки
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION update_category()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.price_new <= 50000 THEN
                    NEW.category_id := 1; -- Эконом
                ELSIF NEW.price_new <= 100000 THEN
                    NEW.category_id := 2; -- Стандарт
                ELSE
                    NEW.category_id := 3; -- Премиум
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            DROP TRIGGER IF EXISTS update_category_trigger ON doors;
            CREATE TRIGGER update_category_trigger
            BEFORE INSERT OR UPDATE ON doors
            FOR EACH ROW
            EXECUTE FUNCTION update_category();
        `);

        // Удаляем старую колонку
        await queryRunner.query(`
            ALTER TABLE doors 
            DROP COLUMN price
        `);

        // Переименовываем новую колонку
        await queryRunner.query(`
            ALTER TABLE doors 
            RENAME COLUMN price_new TO price
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Создаем временную колонку
        await queryRunner.query(`
            ALTER TABLE doors 
            ADD COLUMN price_old decimal(10,2)
        `);

        // Копируем данные обратно
        await queryRunner.query(`
            UPDATE doors 
            SET price_old = price
        `);

        // Возвращаем старый триггер
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION update_category()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.price_old <= 50000 THEN
                    NEW.category_id := 1; -- Эконом
                ELSIF NEW.price_old <= 100000 THEN
                    NEW.category_id := 2; -- Стандарт
                ELSE
                    NEW.category_id := 3; -- Премиум
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            DROP TRIGGER IF EXISTS update_category_trigger ON doors;
            CREATE TRIGGER update_category_trigger
            BEFORE INSERT OR UPDATE ON doors
            FOR EACH ROW
            EXECUTE FUNCTION update_category();
        `);

        // Удаляем новую колонку
        await queryRunner.query(`
            ALTER TABLE doors 
            DROP COLUMN price
        `);

        // Переименовываем старую колонку обратно
        await queryRunner.query(`
            ALTER TABLE doors 
            RENAME COLUMN price_old TO price
        `);
    }
} 