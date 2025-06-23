import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1750242288567 implements MigrationInterface {
    name = 'Migration1750242288567'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."incident_chain_enum" AS ENUM('Polkadot', 'Kusama', 'AssetHubPolkadot', 'AssetHubKusama', 'PeoplePolkadot', 'PeopleKusama', 'Centrifuge')`);
        await queryRunner.query(`CREATE TABLE "incident" ("id" character varying NOT NULL, "message" character varying NOT NULL, "block_number" integer, "chain" "public"."incident_chain_enum" NOT NULL, "account" character varying NOT NULL, "group_id" character varying NOT NULL, "handler_type" character varying NOT NULL, "idempotency_key" character varying NOT NULL, "needs_ack" boolean NOT NULL DEFAULT false, "is_acked" boolean NOT NULL DEFAULT false, "acked_by" character varying, "acked_at" TIMESTAMP, "is_resolved" boolean NOT NULL DEFAULT false, "resolved_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5f90b28b0b8238d89ee8edcf96e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_07cfcd6fc6b79b23b7227927fe" ON "incident" ("idempotency_key", "is_resolved") `);
        await queryRunner.query(`CREATE TYPE "public"."notification_messenger_type_enum" AS ENUM('Matrix', 'Slack', 'Telegram')`);
        await queryRunner.query(`CREATE TYPE "public"."notification_type_enum" AS ENUM('Alert', 'Resolution')`);
        await queryRunner.query(`CREATE TABLE "notification" ("id" SERIAL NOT NULL, "incident_id" character varying NOT NULL, "channel_id" character varying NOT NULL, "messenger_type" "public"."notification_messenger_type_enum" NOT NULL, "type" "public"."notification_type_enum" NOT NULL, "repeat_hours" double precision NOT NULL, "last_sent_at" TIMESTAMP, "is_delivered" boolean NOT NULL DEFAULT false, "message" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "incidentId" character varying, CONSTRAINT "PK_705b6c7cdf9b2c2ff7ac7872cb7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "notification" ADD CONSTRAINT "FK_246f28e1f7221dd8dd3f27569f3" FOREIGN KEY ("incidentId") REFERENCES "incident"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification" DROP CONSTRAINT "FK_246f28e1f7221dd8dd3f27569f3"`);
        await queryRunner.query(`DROP TABLE "notification"`);
        await queryRunner.query(`DROP TYPE "public"."notification_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_messenger_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_07cfcd6fc6b79b23b7227927fe"`);
        await queryRunner.query(`DROP TABLE "incident"`);
        await queryRunner.query(`DROP TYPE "public"."incident_chain_enum"`);
    }

}
