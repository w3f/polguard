CREATE TYPE "public"."incident_chain_enum" AS ENUM('Polkadot', 'Kusama', 'Paseo', 'AssetHubPolkadot', 'AssetHubKusama', 'AssetHubPaseo', 'PeoplePolkadot', 'PeopleKusama', 'PeoplePaseo', 'Centrifuge', 'Frequency');--> statement-breakpoint
CREATE TYPE "public"."notification_messenger_type_enum" AS ENUM('Matrix', 'Slack', 'Telegram');--> statement-breakpoint
CREATE TYPE "public"."notification_type_enum" AS ENUM('Alert', 'Resolution', 'Escalation');--> statement-breakpoint
CREATE TYPE "public"."incident_resolution_type_enum" AS ENUM('ChainService', 'AutoTimeout', 'Manual');--> statement-breakpoint
CREATE TABLE "incident" (
	"id" varchar PRIMARY KEY NOT NULL,
	"content" jsonb NOT NULL,
	"block_number" integer,
	"event_idx" integer,
	"extrinsic_idx" integer,
	"chain" "incident_chain_enum" NOT NULL,
	"account" varchar NOT NULL,
	"group_id" varchar NOT NULL,
	"handler_type" varchar NOT NULL,
	"idempotency_key" varchar NOT NULL,
	"notification_channels" jsonb NOT NULL,
	"escalation_channels" jsonb,
	"escalation_timeout_ms" integer,
	"needs_ack" boolean DEFAULT false NOT NULL,
	"is_acked" boolean DEFAULT false NOT NULL,
	"acked_by" varchar,
	"acked_at" timestamp,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"resolution_type" "incident_resolution_type_enum",
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"is_escalated" boolean DEFAULT false NOT NULL,
	"escalated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "last_block" (
	"chain" "incident_chain_enum" PRIMARY KEY NOT NULL,
	"block_number" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_id" varchar NOT NULL,
	"channel_id" varchar NOT NULL,
	"messenger_type" "notification_messenger_type_enum" NOT NULL,
	"type" "notification_type_enum" NOT NULL,
	"repeat_firing_ms" integer,
	"last_sent_at" timestamp,
	"is_delivered" boolean DEFAULT false NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_incident_id_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_incident_idempotency_resolved" ON "incident" USING btree ("idempotency_key","is_resolved");