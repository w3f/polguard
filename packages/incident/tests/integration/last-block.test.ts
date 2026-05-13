import { Chain } from '@w3f/polguard-common';
import { createTestApp, clearTables, destroyTestApp, TestContext } from './test-utils';

describe('LastBlock API (integration)', () => {
  let ctx: TestContext;

  const TEST_CHAIN = Chain.Polkadot;
  const TEST_BLOCK_NUMBER = 1000;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await destroyTestApp(ctx);
  });

  beforeEach(async () => {
    await clearTables(ctx);
  });

  const getLastBlock = (chain: string) => ctx.app.inject({ method: 'GET', url: `/last-block/${chain}` });

  const setLastBlock = (chain: string, blockNumber: number) =>
    ctx.app.inject({ method: 'PUT', url: `/last-block/${chain}`, payload: { blockNumber } });

  describe('GET /last-block/:chain', () => {
    it('returns last block for existing chain', async () => {
      await ctx.lastBlockService.setLastBlock(TEST_CHAIN, TEST_BLOCK_NUMBER);

      const response = await getLastBlock(TEST_CHAIN);
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        chain: TEST_CHAIN,
        blockNumber: TEST_BLOCK_NUMBER,
      });
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();
    });

    it('returns null for non-existent chain', async () => {
      const response = await getLastBlock(TEST_CHAIN);
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe('null');
    });

    it('returns 400 for invalid chain parameter', async () => {
      const response = await getLastBlock('InvalidChain');
      expect(response.statusCode).toBe(400);
    });

    it('works with different chains', async () => {
      await ctx.lastBlockService.setLastBlock(Chain.Kusama, 2000);
      await ctx.lastBlockService.setLastBlock(Chain.Polkadot, 3000);

      const kusamaResponse = await getLastBlock(Chain.Kusama);
      const polkadotResponse = await getLastBlock(Chain.Polkadot);

      expect(JSON.parse(kusamaResponse.body).blockNumber).toBe(2000);
      expect(JSON.parse(polkadotResponse.body).blockNumber).toBe(3000);
    });
  });

  describe('PUT /last-block/:chain', () => {
    it('creates new last block entry', async () => {
      const response = await setLastBlock(TEST_CHAIN, TEST_BLOCK_NUMBER);
      expect(response.statusCode).toBe(200);

      const lastBlock = await ctx.lastBlockService.getLastBlock(TEST_CHAIN);
      expect(lastBlock).toMatchObject({
        chain: TEST_CHAIN,
        blockNumber: TEST_BLOCK_NUMBER,
      });
    });

    it('updates existing last block with higher block number', async () => {
      await ctx.lastBlockService.setLastBlock(TEST_CHAIN, 1000);

      const response = await setLastBlock(TEST_CHAIN, 1500);
      expect(response.statusCode).toBe(200);

      const lastBlock = await ctx.lastBlockService.getLastBlock(TEST_CHAIN);
      expect(lastBlock?.blockNumber).toBe(1500);
    });

    it('allows setting same block number', async () => {
      await ctx.lastBlockService.setLastBlock(TEST_CHAIN, 1000);

      const response = await setLastBlock(TEST_CHAIN, 1000);
      expect(response.statusCode).toBe(200);

      const lastBlock = await ctx.lastBlockService.getLastBlock(TEST_CHAIN);
      expect(lastBlock?.blockNumber).toBe(1000);
    });

    it('rejects lower block number with 409', async () => {
      await ctx.lastBlockService.setLastBlock(TEST_CHAIN, 1000);

      const response = await setLastBlock(TEST_CHAIN, 999);
      expect(response.statusCode).toBe(409);

      const lastBlock = await ctx.lastBlockService.getLastBlock(TEST_CHAIN);
      expect(lastBlock?.blockNumber).toBe(1000);
    });

    it('validates required fields', async () => {
      const emptyBody = await ctx.app.inject({ method: 'PUT', url: `/last-block/${TEST_CHAIN}`, payload: {} });
      expect(emptyBody.statusCode).toBe(400);

      const invalidChain = await setLastBlock('InvalidChain', 1000);
      expect(invalidChain.statusCode).toBe(400);
    });

    it('handles multiple chains independently', async () => {
      await setLastBlock(Chain.Polkadot, 1000);
      await setLastBlock(Chain.Kusama, 2000);

      const polkadotBlock = await ctx.lastBlockService.getLastBlock(Chain.Polkadot);
      const kusamaBlock = await ctx.lastBlockService.getLastBlock(Chain.Kusama);

      expect(polkadotBlock?.blockNumber).toBe(1000);
      expect(kusamaBlock?.blockNumber).toBe(2000);
    });
  });
});
