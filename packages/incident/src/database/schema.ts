import { pgTable, pgEnum, varchar, integer, boolean, timestamp, text, jsonb, serial, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { Chain, MessengerType, NotificationType, ResolutionType, type NotificationChannel } from '@w3f/polguard-common';

// --- Enums  ---

export const chainEnum = pgEnum('incident_chain_enum', Object.values(Chain) as [string, ...string[]]);
export const messengerTypeEnum = pgEnum(
  'notification_messenger_type_enum',
  Object.values(MessengerType) as [string, ...string[]],
);
export const notificationTypeEnum = pgEnum(
  'notification_type_enum',
  Object.values(NotificationType) as [string, ...string[]],
);
export const resolutionTypeEnum = pgEnum(
  'incident_resolution_type_enum',
  Object.values(ResolutionType) as [string, ...string[]],
);

// --- Tables ---

export const incidents = pgTable(
  'incident',
  {
    id: varchar('id').primaryKey(),
    message: varchar('message').notNull(),
    blockNumber: integer('block_number'),
    eventIdx: integer('event_idx'),
    extrinsicIdx: integer('extrinsic_idx'),
    chain: chainEnum('chain').notNull(),
    account: varchar('account').notNull(),
    groupId: varchar('group_id').notNull(),
    handlerType: varchar('handler_type').notNull(),
    idempotencyKey: varchar('idempotency_key').notNull(),
    notificationChannels: jsonb('notification_channels').$type<NotificationChannel[]>().notNull(),
    escalationChannels: jsonb('escalation_channels').$type<NotificationChannel[]>(),
    escalationTimeoutMs: integer('escalation_timeout_ms'),
    needsAck: boolean('needs_ack').notNull().default(false),
    isAcked: boolean('is_acked').notNull().default(false),
    ackedBy: varchar('acked_by'),
    ackedAt: timestamp('acked_at'),
    isResolved: boolean('is_resolved').notNull().default(false),
    resolutionType: resolutionTypeEnum('resolution_type'),
    resolvedBy: varchar('resolved_by'),
    resolvedAt: timestamp('resolved_at'),
    resolutionMessage: varchar('resolution_message'),
    isEscalated: boolean('is_escalated').notNull().default(false),
    escalatedAt: timestamp('escalated_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => [index('idx_incident_idempotency_resolved').on(table.idempotencyKey, table.isResolved)],
);

export const notifications = pgTable('notification', {
  id: serial('id').primaryKey(),
  incidentId: varchar('incident_id')
    .notNull()
    .references(() => incidents.id, { onDelete: 'cascade' }),
  channelId: varchar('channel_id').notNull(),
  messengerType: messengerTypeEnum('messenger_type').notNull(),
  type: notificationTypeEnum('type').notNull(),
  repeatFiringMs: integer('repeat_firing_ms'),
  lastSentAt: timestamp('last_sent_at'),
  isDelivered: boolean('is_delivered').notNull().default(false),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const lastBlocks = pgTable('last_block', {
  chain: chainEnum('chain').primaryKey(),
  blockNumber: integer('block_number').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// --- Relations ---

export const incidentRelations = relations(incidents, ({ many }) => ({
  notifications: many(notifications),
}));

export const notificationRelations = relations(notifications, ({ one }) => ({
  incident: one(incidents, {
    fields: [notifications.incidentId],
    references: [incidents.id],
  }),
}));
