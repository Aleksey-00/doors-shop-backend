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
            SET price_new = price
        `);

        // Обновляем функцию триггера
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION update_category()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.price <= 50000 THEN
                    NEW.category = 'Эконом';
                ELSIF NEW.price <= 100000 THEN
                    NEW.category = 'Стандарт';
                ELSIF NEW.price <= 150000 THEN
                    NEW.category = 'Премиум';
                ELSE
                    NEW.category = 'Люкс';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
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

        // Пересоздаем триггер
        await queryRunner.query(`
            DROP TRIGGER IF EXISTS update_category_trigger ON doors;
            CREATE TRIGGER update_category_trigger
            BEFORE INSERT OR UPDATE ON doors
            FOR EACH ROW
            EXECUTE FUNCTION update_category();
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Создаем временную колонку для отката
        await queryRunner.query(`
            ALTER TABLE doors 
            ADD COLUMN price_old numeric
        `);

        // Копируем данные обратно
        await queryRunner.query(`
            UPDATE doors 
            SET price_old = price
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

        // Восстанавливаем старую функцию триггера
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION update_category()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.price <= 50000 THEN
                    NEW.category = 'Эконом';
                ELSIF NEW.price <= 100000 THEN
                    NEW.category = 'Стандарт';
                ELSIF NEW.price <= 150000 THEN
                    NEW.category = 'Премиум';
                ELSE
                    NEW.category = 'Люкс';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Пересоздаем триггер
        await queryRunner.query(`
            DROP TRIGGER IF EXISTS update_category_trigger ON doors;
            CREATE TRIGGER update_category_trigger
            BEFORE INSERT OR UPDATE ON doors
            FOR EACH ROW
            EXECUTE FUNCTION update_category();
        `);
    }
} 