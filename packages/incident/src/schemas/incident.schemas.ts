import { Type, Static } from '@sinclair/typebox';
import { Chain, MessengerType } from '@w3f/polguard-common';

// --- Shared sub-schemas ---

const NotificationChannelSchema = Type.Object({
  channelId: Type.String({ minLength: 1 }),
  messengerType: Type.Enum(MessengerType),
  repeatFiringMs: Type.Optional(Type.Number()),
});

// --- Request schemas ---

export const CreateIncidentSchema = Type.Object({
  message: Type.String({ minLength: 1 }),
  chain: Type.Enum(Chain),
  blockNumber: Type.Number(),
  account: Type.String({ minLength: 1 }),
  groupId: Type.String({ minLength: 1 }),
  handlerType: Type.String({ minLength: 1 }),
  notificationChannels: Type.Array(NotificationChannelSchema, { minItems: 1 }),
  escalationChannels: Type.Optional(Type.Array(NotificationChannelSchema)),
  escalationTimeoutMs: Type.Optional(Type.Number()),
  needsAck: Type.Optional(Type.Boolean({ default: false })),
  isResolved: Type.Optional(Type.Boolean({ default: false })),
  idempotencyKey: Type.String({ minLength: 1 }),
  eventIdx: Type.Optional(Type.Number()),
  extrinsicIdx: Type.Optional(Type.Number()),
});
export type CreateIncidentBody = Static<typeof CreateIncidentSchema>;

export const GetIncidentsSchema = Type.Object({
  createdAfter: Type.Optional(Type.String({ format: 'date-time' })),
  createdBefore: Type.Optional(Type.String({ format: 'date-time' })),
  chain: Type.Optional(Type.Enum(Chain)),
  account: Type.Optional(Type.String()),
  groupId: Type.Optional(Type.String()),
  handlerType: Type.Optional(Type.String()),
  channelId: Type.Optional(Type.String()),
  messengerType: Type.Optional(Type.Enum(MessengerType)),
  needsAck: Type.Optional(Type.Boolean()),
  isAcked: Type.Optional(Type.Boolean()),
  isResolved: Type.Optional(Type.Boolean()),
});
export type GetIncidentsQuery = Static<typeof GetIncidentsSchema>;

export const AcknowledgeIncidentSchema = Type.Object({
  username: Type.String({ minLength: 1 }),
  channelId: Type.String({ minLength: 1 }),
});
export type AcknowledgeIncidentBody = Static<typeof AcknowledgeIncidentSchema>;

export const ResolveByChainSchema = Type.Object({
  chain: Type.Enum(Chain),
  blockNumber: Type.Number(),
  resolutionMessage: Type.String(),
});
export type ResolveByChainBody = Static<typeof ResolveByChainSchema>;

export const ResolveManuallySchema = Type.Object({
  username: Type.String({ minLength: 1 }),
  channelId: Type.String({ minLength: 1 }),
});
export type ResolveManuallyBody = Static<typeof ResolveManuallySchema>;

export const IncidentIdParamsSchema = Type.Object({
  id: Type.String(),
});
export type IncidentIdParams = Static<typeof IncidentIdParamsSchema>;
