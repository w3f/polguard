import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1754404990711 implements MigrationInterface {
  name = 'Migration1754404990711';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."last_block_chain_enum" AS ENUM('Polkadot', 'Kusama', 'AssetHubPolkadot', 'AssetHubKusama', 'PeoplePolkadot', 'PeopleKusama', 'Centrifuge')`,
    );
    await queryRunner.query(
      `CREATE TABLE "last_block" ("chain" "public"."last_block_chain_enum" NOT NULL, "block_number" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f10a6bd824ba55bcb2af55f3eec" PRIMARY KEY ("chain"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "last_block"`);
    await queryRunner.query(`DROP TYPE "public"."last_block_chain_enum"`);
  }
}
