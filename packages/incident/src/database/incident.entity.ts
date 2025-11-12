import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  BeforeInsert,
} from 'typeorm';
import { Chain, MessengerType, ResolutionType } from '@w3f/monitoring-common';
import type { Notification } from './notification.entity';
import { generateIncidentId } from './id-generator';

@Entity()
@Index(['idempotencyKey', 'isResolved'])
export class Incident {
  @PrimaryColumn()
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateIncidentId();
    }
  }

  @Column()
  message: string;

  @Column({ nullable: true })
  blockNumber: number;

  @Column({ nullable: true })
  eventIdx?: number;

  @Column({ nullable: true })
  extrinsicIdx?: number;

  @Column({ type: 'simple-enum', enum: Chain })
  chain: Chain;

  @Column()
  account: string;

  @Column()
  groupId: string;

  @Column()
  handlerType: string;

  @Column()
  idempotencyKey: string;

  @Column({ type: 'simple-json' })
  notificationChannels: { channelId: string; messengerType: MessengerType; repeatFiringMs?: number }[];

  @Column({ type: 'simple-json', nullable: true })
  escalationChannels?: { channelId: string; messengerType: MessengerType }[];

  @Column({ type: 'integer', nullable: true })
  escalationTimeoutMs?: number;

  @Column({ default: false })
  needsAck: boolean;

  @Column({ default: false })
  isAcked: boolean;

  @Column({ nullable: true })
  ackedBy: string;

  @Column({ nullable: true })
  ackedAt: Date;

  @Column({ default: false })
  isResolved: boolean;

  @Column({ type: 'simple-enum', enum: ResolutionType, nullable: true })
  resolutionType?: ResolutionType;

  @Column({ nullable: true })
  resolvedBy?: string;

  @Column({ nullable: true })
  resolvedAt: Date;

  @Column({ nullable: true })
  resolutionMessage?: string;

  @Column({ default: false })
  isEscalated: boolean;

  @Column({ nullable: true })
  escalatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany('Notification', 'incident', { cascade: true, onDelete: 'CASCADE' })
  notifications: Notification[];
}
