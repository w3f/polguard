import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Chain } from '@w3f/polguard-common';
import { DataSource } from 'typeorm';
import { cleanupTestDatabase, createTestApp } from './test-utils';
import { LastBlock } from '../../src/database/last-block.entity';

describe('LastBlock API (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const TEST_CHAIN = Chain.Polkadot;
  const TEST_BLOCK_NUMBER = 1000;

  const getLastBlock = (chain: Chain) => request(app.getHttpServer()).get(`/last-block/${chain}`);

  const setLastBlock = (chain: Chain, blockNumber: number) =>
    request(app.getHttpServer()).put(`/last-block/${chain}`).send({ blockNumber });

  const createLastBlockInDb = async (chain: Chain, blockNumber: number) => {
    await dataSource.getRepository(LastBlock).save({ chain, blockNumber });
  };

  beforeAll(async () => {
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;
    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await app.close();
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Clear database before each test
    await dataSource.getRepository(LastBlock).clear();
  });

  describe('GET /last-block/:chain', () => {
    it('returns last block for existing chain', async () => {
      await createLastBlockInDb(TEST_CHAIN, TEST_BLOCK_NUMBER);

      const response = await getLastBlock(TEST_CHAIN).expect(200);

      expect(response.body).toMatchObject({
        chain: TEST_CHAIN,
        blockNumber: TEST_BLOCK_NUMBER,
      });
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
    });

    it('returns empty object for non-existent chain', async () => {
      // Service returns null, but JSONbig.stringify converts it to {}
      const response = await getLastBlock(TEST_CHAIN).expect(200);
      expect(response.body).toEqual({});
    });

    it('returns 400 for invalid chain parameter', async () => {
      await request(app.getHttpServer()).get('/last-block/InvalidChain').expect(400);
    });

    it('works with different chains', async () => {
      await createLastBlockInDb(Chain.Kusama, 2000);
      await createLastBlockInDb(Chain.Polkadot, 3000);

      const kusamaResponse = await getLastBlock(Chain.Kusama).expect(200);
      const polkadotResponse = await getLastBlock(Chain.Polkadot).expect(200);

      expect(kusamaResponse.body.blockNumber).toBe(2000);
      expect(polkadotResponse.body.blockNumber).toBe(3000);
    });
  });

  describe('PUT /last-block/:chain', () => {
    it('creates new last block entry', async () => {
      await setLastBlock(TEST_CHAIN, TEST_BLOCK_NUMBER).expect(200);

      const lastBlock = await dataSource.getRepository(LastBlock).findOne({
        where: { chain: TEST_CHAIN },
      });
      expect(lastBlock).toMatchObject({
        chain: TEST_CHAIN,
        blockNumber: TEST_BLOCK_NUMBER,
      });
    });

    it('updates existing last block with higher block number', async () => {
      await createLastBlockInDb(TEST_CHAIN, 1000);

      await setLastBlock(TEST_CHAIN, 1500).expect(200);

      const lastBlock = await dataSource.getRepository(LastBlock).findOne({
        where: { chain: TEST_CHAIN },
      });
      expect(lastBlock?.blockNumber).toBe(1500);
    });

    it('allows setting same block number', async () => {
      await createLastBlockInDb(TEST_CHAIN, 1000);

      await setLastBlock(TEST_CHAIN, 1000).expect(200);

      const lastBlock = await dataSource.getRepository(LastBlock).findOne({
        where: { chain: TEST_CHAIN },
      });
      expect(lastBlock?.blockNumber).toBe(1000);
    });

    it('rejects lower block number with 409', async () => {
      await createLastBlockInDb(TEST_CHAIN, 1000);

      await setLastBlock(TEST_CHAIN, 999).expect(409);

      // Verify block number wasn't changed
      const lastBlock = await dataSource.getRepository(LastBlock).findOne({
        where: { chain: TEST_CHAIN },
      });
      expect(lastBlock?.blockNumber).toBe(1000);
    });

    it('validates required fields', async () => {
      await request(app.getHttpServer()).put(`/last-block/${TEST_CHAIN}`).send({}).expect(400);

      await request(app.getHttpServer()).put('/last-block/InvalidChain').send({ blockNumber: 1000 }).expect(400);
    });

    it('handles multiple chains independently', async () => {
      await setLastBlock(Chain.Polkadot, 1000).expect(200);
      await setLastBlock(Chain.Kusama, 2000).expect(200);

      const polkadotBlock = await dataSource.getRepository(LastBlock).findOne({
        where: { chain: Chain.Polkadot },
      });
      const kusamaBlock = await dataSource.getRepository(LastBlock).findOne({
        where: { chain: Chain.Kusama },
      });

      expect(polkadotBlock?.blockNumber).toBe(1000);
      expect(kusamaBlock?.blockNumber).toBe(2000);
    });

    it('updates existing record when block number changes', async () => {
      await createLastBlockInDb(TEST_CHAIN, 1000);

      await setLastBlock(TEST_CHAIN, 1500).expect(200);

      const updatedBlock = await dataSource.getRepository(LastBlock).findOne({
        where: { chain: TEST_CHAIN },
      });

      expect(updatedBlock?.blockNumber).toBe(1500);
      expect(updatedBlock?.updatedAt).toBeDefined();
    });
  });
});
