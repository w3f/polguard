import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Chain, MessengerType, NotificationType } from '@w3f/monitoring-types';

@Entity('incidents')
@Index(['chain', 'account', 'groupId', 'handlerType'])
export class Incident {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  message: string;

  @Column({ name: 'block_number', nullable: true })
  blockNumber: number;

  @Column({
    type: 'simple-enum',
    enum: Chain,
  })
  chain: Chain;

  @Column()
  account: string;

  @Column({ name: 'group_id' })
  groupId: string;

  @Column({ name: 'handler_type' })
  handlerType: string;

  @Column({ name: 'needs_ack', default: false })
  needsAck: boolean;

  @Column({ name: 'is_acked', default: false })
  isAcked: boolean;

  @Column({ name: 'acked_by', nullable: true })
  ackedBy: string;

  @Column({ name: 'acked_at', nullable: true })
  ackedAt: Date;

  @Column({ name: 'is_resolved', default: false })
  isResolved: boolean;

  @Column({ name: 'resolved_at', nullable: true })
  resolvedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => IncidentNotification, notification => notification.incident)
  notifications: IncidentNotification[];
}

@Entity('incident_notifications')
export class IncidentNotification {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Incident, incident => incident.notifications)
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;

  @Column({ name: 'channel_id' })
  channelId: string;

  @Column({
    type: 'simple-enum',
    enum: MessengerType,
  })
  messengerType: MessengerType;

  @Column({
    type: 'simple-enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({
    name: 'repeat_hours',
    type: 'double precision',
  })
  repeatHours: number;

  @Column({ name: 'last_sent_at', nullable: true })
  lastSentAt: Date;

  @Column({ name: 'is_delivered', default: false })
  isDelivered: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
