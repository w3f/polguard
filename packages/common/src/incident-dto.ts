import { Type, Static } from '@sinclair/typebox';
import { Chain } from './constants';
import { MessengerType } from './notification';


export const IncidentContentSchema = Type.Object({
  subject: Type.Optional(Type.Object({ name: Type.String(), address: Type.String() })),
  condition: Type.String({ minLength: 1 }),
  details: Type.Array(Type.String()),
});
export type IncidentContent = Static<typeof IncidentContentSchema>;

export const NotificationChannelSchema = Type.Object({
  channelId: Type.String({ minLength: 1 }),
  messengerType: Type.Enum(MessengerType),
  repeatFiringMs: Type.Optional(Type.Number()),
});
export type NotificationChannel = Static<typeof NotificationChannelSchema>;

export const CreateIncidentSchema = Type.Object({
  content: IncidentContentSchema,
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

export const ResolveByChainSchema = Type.Object({
  chain: Type.Enum(Chain),
  blockNumber: Type.Number(),
  content: IncidentContentSchema,
});
export type ResolveByChainBody = Static<typeof ResolveByChainSchema>;

// One schema for both /acknowledge and /resolve-manual
export const ChannelUserActionSchema = Type.Object({
  username: Type.String({ minLength: 1 }),
  channelId: Type.String({ minLength: 1 }),
});
export type ChannelUserActionBody = Static<typeof ChannelUserActionSchema>;

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

export interface NotificationResponse {
  id: number;
  incidentId: string;
  channelId: string;
  messengerType: string;
  type: string;
  repeatFiringMs?: number;
  lastSentAt?: string;
  isDelivered: boolean;
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentResponse {
  id: string;
  content: IncidentContent;
  blockNumber: number;
  eventIdx?: number;
  extrinsicIdx?: number;
  chain: string;
  account: string;
  groupId: string;
  handlerType: string;
  needsAck: boolean;
  isAcked: boolean;
  ackedBy?: string;
  ackedAt?: string;
  isResolved: boolean;
  resolvedAt?: string;
  isEscalated: boolean;
  escalatedAt?: string;
  createdAt: string;
  updatedAt: string;
  notifications?: NotificationResponse[];
}
