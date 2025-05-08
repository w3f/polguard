import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1746526622729 implements MigrationInterface {
    name = 'Migration1746526622729'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."incidents_chain_enum" AS ENUM('Polkadot', 'Kusama', 'AssetHubPolkadot', 'AssetHubKusama', 'PeoplePolkadot', 'PeopleKusama', 'Centrifuge')`);
        await queryRunner.query(`CREATE TABLE "incidents" ("id" SERIAL NOT NULL, "message" character varying NOT NULL, "block_number" integer, "chain" "public"."incidents_chain_enum" NOT NULL, "account" character varying NOT NULL, "group_id" character varying NOT NULL, "handler_type" character varying NOT NULL, "needs_ack" boolean NOT NULL DEFAULT false, "is_acked" boolean NOT NULL DEFAULT false, "acked_by" character varying, "acked_at" TIMESTAMP, "is_resolved" boolean NOT NULL DEFAULT false, "resolved_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ccb34c01719889017e2246469f9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cfd7e67d7cad6ecc801eeffbcf" ON "incidents" ("chain", "account", "group_id", "handler_type") `);
        await queryRunner.query(`CREATE TYPE "public"."incident_notifications_messengertype_enum" AS ENUM('matrix', 'slack', 'telegram')`);
        await queryRunner.query(`CREATE TYPE "public"."incident_notifications_type_enum" AS ENUM('alert', 'resolution')`);
        await queryRunner.query(`CREATE TABLE "incident_notifications" ("id" SERIAL NOT NULL, "channel_id" character varying NOT NULL, "messengerType" "public"."incident_notifications_messengertype_enum" NOT NULL, "type" "public"."incident_notifications_type_enum" NOT NULL, "repeat_hours" double precision NOT NULL, "last_sent_at" TIMESTAMP, "is_delivered" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "incident_id" integer, CONSTRAINT "PK_48597d225b5e03870aa30afc4d7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "incident_notifications" ADD CONSTRAINT "FK_45b17252b798b0bbc2473fa649f" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "incident_notifications" DROP CONSTRAINT "FK_45b17252b798b0bbc2473fa649f"`);
        await queryRunner.query(`DROP TABLE "incident_notifications"`);
        await queryRunner.query(`DROP TYPE "public"."incident_notifications_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."incident_notifications_messengertype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cfd7e67d7cad6ecc801eeffbcf"`);
        await queryRunner.query(`DROP TABLE "incidents"`);
        await queryRunner.query(`DROP TYPE "public"."incidents_chain_enum"`);
    }

}
