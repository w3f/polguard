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
import { Chain } from '@w3f/monitoring-types';
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

  @Column({ nullable: true })
  resolvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany('Notification', 'incident', { cascade: true, onDelete: 'CASCADE' })
  notifications: Notification[];
}
