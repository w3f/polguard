import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1756565003385 implements MigrationInterface {
    name = 'Migration1756565003385'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Delete notifications that belong to unresolved incidents
        await queryRunner.query(`
        DELETE FROM "notification" n
        USING "incident" i
        WHERE n."incident_id" = i."id"
            AND i."is_resolved" = false
        `);

        // Delete unresolved incidents
        await queryRunner.query(`
        DELETE FROM "incident"
        WHERE "is_resolved" = false
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Irreversible data deletion;
    }

}
