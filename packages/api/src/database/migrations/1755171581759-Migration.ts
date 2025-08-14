import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1755171581759 implements MigrationInterface {
    name = 'Migration1755171581759'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add new columns to incident table
        await queryRunner.query(`ALTER TABLE "incident" ADD "notification_channels" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "incident" ADD "escalation_channels" text`);
        await queryRunner.query(`ALTER TABLE "incident" ADD "escalation_timeout_ms" integer`);
        await queryRunner.query(`ALTER TABLE "incident" ADD "is_escalated" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "incident" ADD "escalated_at" TIMESTAMP`);
        
        // Update notification type enum
        await queryRunner.query(`ALTER TYPE "public"."notification_type_enum" RENAME TO "notification_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."notification_type_enum" AS ENUM('Alert', 'Resolution', 'Escalation')`);
        await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "type" TYPE "public"."notification_type_enum" USING "type"::"text"::"public"."notification_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_type_enum_old"`);
        
        // Migrate repeat_hours to repeat_firing_ms
        await queryRunner.query(`ALTER TABLE "notification" RENAME COLUMN "repeat_hours" TO "repeat_hours_temp"`);
        await queryRunner.query(`ALTER TABLE "notification" ADD "repeat_firing_ms" integer`);
        await queryRunner.query(`UPDATE "notification" SET "repeat_firing_ms" = CAST("repeat_hours_temp" * 3600000 AS integer) WHERE "repeat_hours_temp" IS NOT NULL`);
        await queryRunner.query(`ALTER TABLE "notification" DROP COLUMN "repeat_hours_temp"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverse repeat_hours and repeat_firing_ms
        await queryRunner.query(`ALTER TABLE "notification" RENAME COLUMN "repeat_firing_ms" TO "repeat_firing_ms_temp"`);
        await queryRunner.query(`ALTER TABLE "notification" ADD "repeat_hours" double precision`);
        await queryRunner.query(`UPDATE "notification" SET "repeat_hours" = CAST("repeat_firing_ms_temp" / 3600000.0 AS double precision) WHERE "repeat_firing_ms_temp" IS NOT NULL`);
        await queryRunner.query(`ALTER TABLE "notification" DROP COLUMN "repeat_firing_ms_temp"`);
        
        // Reverse enum changes
        await queryRunner.query(`CREATE TYPE "public"."notification_type_enum_old" AS ENUM('Alert', 'Resolution')`);
        await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "type" TYPE "public"."notification_type_enum_old" USING "type"::"text"::"public"."notification_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."notification_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."notification_type_enum_old" RENAME TO "notification_type_enum"`);
        
        // Remove incident columns
        await queryRunner.query(`ALTER TABLE "incident" DROP COLUMN "escalated_at"`);
        await queryRunner.query(`ALTER TABLE "incident" DROP COLUMN "is_escalated"`);
        await queryRunner.query(`ALTER TABLE "incident" DROP COLUMN "escalation_timeout_ms"`);
        await queryRunner.query(`ALTER TABLE "incident" DROP COLUMN "escalation_channels"`);
        await queryRunner.query(`ALTER TABLE "incident" DROP COLUMN "notification_channels"`);
    }

}
