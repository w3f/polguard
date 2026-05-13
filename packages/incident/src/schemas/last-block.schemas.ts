import { Type, Static } from '@sinclair/typebox';
import { Chain } from '@w3f/polguard-common';

export const ChainParamsSchema = Type.Object({
  chain: Type.Enum(Chain),
});
export type ChainParams = Static<typeof ChainParamsSchema>;

export const UpdateLastBlockSchema = Type.Object({
  blockNumber: Type.Number(),
});
export type UpdateLastBlockBody = Static<typeof UpdateLastBlockSchema>;
