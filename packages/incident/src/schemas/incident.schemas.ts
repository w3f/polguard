import { Type, Static } from '@sinclair/typebox';

export {
  CreateIncidentSchema,
  type CreateIncidentBody,
  ResolveByChainSchema,
  type ResolveByChainBody,
  ChannelUserActionSchema,
  type ChannelUserActionBody,
  GetIncidentsSchema,
  type GetIncidentsQuery,
} from '@w3f/polguard-common';

export const IncidentIdParamsSchema = Type.Object({
  id: Type.String(),
});
export type IncidentIdParams = Static<typeof IncidentIdParamsSchema>;
