import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateRequestsTables1709654400000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: "measurement_requests",
            columns: [
                {
                    name: "id",
                    type: "uuid",
                    isPrimary: true,
                },
                {
                    name: "name",
                    type: "varchar",
                },
                {
                    name: "phone",
                    type: "varchar",
                },
                {
                    name: "address",
                    type: "varchar",
                },
                {
                    name: "comments",
                    type: "text",
                    isNullable: true,
                },
                {
                    name: "status",
                    type: "varchar",
                    default: "'pending'",
                },
                {
                    name: "created_at",
                    type: "timestamp",
                    default: "now()",
                },
                {
                    name: "updated_at",
                    type: "timestamp",
                    default: "now()",
                },
            ],
        }));

        await queryRunner.createTable(new Table({
            name: "callback_requests",
            columns: [
                {
                    name: "id",
                    type: "uuid",
                    isPrimary: true,
                },
                {
                    name: "name",
                    type: "varchar",
                },
                {
                    name: "phone",
                    type: "varchar",
                },
                {
                    name: "comments",
                    type: "text",
                    isNullable: true,
                },
                {
                    name: "status",
                    type: "varchar",
                    default: "'pending'",
                },
                {
                    name: "created_at",
                    type: "timestamp",
                    default: "now()",
                },
                {
                    name: "updated_at",
                    type: "timestamp",
                    default: "now()",
                },
            ],
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("callback_requests");
        await queryRunner.dropTable("measurement_requests");
    }
} 