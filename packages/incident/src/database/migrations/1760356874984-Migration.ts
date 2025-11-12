import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1760356874984 implements MigrationInterface {
    name = 'Migration1760356874984'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "incident" ADD "resolution_message" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "incident" DROP COLUMN "resolution_message"`);
    }

}
