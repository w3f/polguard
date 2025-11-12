import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1760089241688 implements MigrationInterface {
    name = 'Migration1760089241688'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create new enum type and add new columns
        await queryRunner.query(`CREATE TYPE "public"."incident_resolution_type_enum" AS ENUM('ChainService', 'AutoTimeout', 'Manual')`);
        await queryRunner.query(`ALTER TABLE "incident" ADD "resolution_type" "public"."incident_resolution_type_enum"`);
        await queryRunner.query(`ALTER TABLE "incident" ADD "resolved_by" character varying`);
        
        // Migrate existing data: if is_auto_resolved = true, set AutoTimeout; otherwise ChainService
        await queryRunner.query(`UPDATE "incident" SET "resolution_type" = 'AutoTimeout' WHERE "is_auto_resolved" = true AND "is_resolved" = true`);
        await queryRunner.query(`UPDATE "incident" SET "resolution_type" = 'ChainService' WHERE "is_auto_resolved" = false AND "is_resolved" = true`);
        
        // Drop old column
        await queryRunner.query(`ALTER TABLE "incident" DROP COLUMN "is_auto_resolved"`);
        
        // Update chain enums for incident table
        await queryRunner.query(`ALTER TYPE "public"."incident_chain_enum" RENAME TO "incident_chain_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."incident_chain_enum" AS ENUM('Polkadot', 'Kusama', 'Paseo', 'AssetHubPolkadot', 'AssetHubKusama', 'AssetHubPaseo', 'PeoplePolkadot', 'PeopleKusama', 'PeoplePaseo', 'Centrifuge')`);
        await queryRunner.query(`ALTER TABLE "incident" ALTER COLUMN "chain" TYPE "public"."incident_chain_enum" USING "chain"::"text"::"public"."incident_chain_enum"`);
        await queryRunner.query(`DROP TYPE "public"."incident_chain_enum_old"`);
        
        // Update chain enums for last_block table
        await queryRunner.query(`ALTER TYPE "public"."last_block_chain_enum" RENAME TO "last_block_chain_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."last_block_chain_enum" AS ENUM('Polkadot', 'Kusama', 'Paseo', 'AssetHubPolkadot', 'AssetHubKusama', 'AssetHubPaseo', 'PeoplePolkadot', 'PeopleKusama', 'PeoplePaseo', 'Centrifuge')`);
        await queryRunner.query(`ALTER TABLE "last_block" ALTER COLUMN "chain" TYPE "public"."last_block_chain_enum" USING "chain"::"text"::"public"."last_block_chain_enum"`);
        await queryRunner.query(`DROP TYPE "public"."last_block_chain_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."last_block_chain_enum_old" AS ENUM('Polkadot', 'Kusama', 'AssetHubPolkadot', 'AssetHubKusama', 'PeoplePolkadot', 'PeopleKusama', 'Centrifuge')`);
        await queryRunner.query(`ALTER TABLE "last_block" ALTER COLUMN "chain" TYPE "public"."last_block_chain_enum_old" USING "chain"::"text"::"public"."last_block_chain_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."last_block_chain_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."last_block_chain_enum_old" RENAME TO "last_block_chain_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."incident_chain_enum_old" AS ENUM('Polkadot', 'Kusama', 'AssetHubPolkadot', 'AssetHubKusama', 'PeoplePolkadot', 'PeopleKusama', 'Centrifuge')`);
        await queryRunner.query(`ALTER TABLE "incident" ALTER COLUMN "chain" TYPE "public"."incident_chain_enum_old" USING "chain"::"text"::"public"."incident_chain_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."incident_chain_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."incident_chain_enum_old" RENAME TO "incident_chain_enum"`);
        await queryRunner.query(`ALTER TABLE "incident" DROP COLUMN "resolved_by"`);
        await queryRunner.query(`ALTER TABLE "incident" DROP COLUMN "resolution_type"`);
        await queryRunner.query(`DROP TYPE "public"."incident_resolution_type_enum"`);
        await queryRunner.query(`ALTER TABLE "incident" ADD "is_auto_resolved" boolean NOT NULL DEFAULT false`);
    }

}
