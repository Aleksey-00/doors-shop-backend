import { MigrationInterface, QueryRunner } from 'typeorm';
import * as crypto from 'crypto';

export class UpdateUserPasswords1710587682123 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Получаем всех пользователей
        const users = await queryRunner.query('SELECT id, password FROM users');
        
        // Обновляем пароли для каждого пользователя
        for (const user of users) {
            // Предполагаем, что у вас есть дефолтный пароль для админа
            // Замените 'admin' на ваш реальный дефолтный пароль
            const defaultPassword = 'admin';
            const hashedPassword = crypto.createHash('sha256').update(defaultPassword).digest('hex');
            
            await queryRunner.query(
                'UPDATE users SET password = $1 WHERE id = $2',
                [hashedPassword, user.id]
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // В случае отката миграции мы не можем восстановить старые пароли,
        // так как хеширование - это односторонняя операция
        console.log('This migration cannot be reverted as it involves password hashing');
    }
} 