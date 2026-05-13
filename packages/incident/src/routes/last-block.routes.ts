import { FastifyInstance } from 'fastify';
import { LastBlockService } from '../last-block/last-block.service';
import {
  ChainParamsSchema,
  UpdateLastBlockSchema,
  type ChainParams,
  type UpdateLastBlockBody,
} from '../schemas/last-block.schemas';

export function lastBlockRoutes(lastBlockService: LastBlockService) {
  return async function (app: FastifyInstance) {
    app.get<{ Params: ChainParams }>(
      '/last-block/:chain',
      {
        schema: {
          params: ChainParamsSchema,
          tags: ['last-block'],
          summary: 'Get the last processed block for a chain',
        },
      },
      async request => {
        return lastBlockService.getLastBlock(request.params.chain);
      },
    );

    app.put<{ Params: ChainParams; Body: UpdateLastBlockBody }>(
      '/last-block/:chain',
      {
        schema: {
          params: ChainParamsSchema,
          body: UpdateLastBlockSchema,
          tags: ['last-block'],
          summary: 'Update the last processed block for a chain',
        },
      },
      async request => {
        await lastBlockService.setLastBlock(request.params.chain, request.body.blockNumber);
      },
    );
  };
}
