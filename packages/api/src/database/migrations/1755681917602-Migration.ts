import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1755681917602 implements MigrationInterface {
  name = 'Migration1755681917602';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "incident" ADD "event_idx" integer`);
    await queryRunner.query(`ALTER TABLE "incident" ADD "extrinsic_idx" integer`);
    await queryRunner.query(`ALTER TABLE "incident" ADD "is_auto_resolved" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "incident" DROP COLUMN "is_auto_resolved"`);
    await queryRunner.query(`ALTER TABLE "incident" DROP COLUMN "extrinsic_idx"`);
    await queryRunner.query(`ALTER TABLE "incident" DROP COLUMN "event_idx"`);
  }
}
