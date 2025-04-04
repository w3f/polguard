import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Chain, MessengerType } from '@w3f/monitoring-types';

@Entity('incidents')
@Index(['chain', 'groupName', 'handlerName', 'wallet'], { where: 'resolved = false' })
export class Incident {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  message: string;

  @Column({ name: 'block_number', nullable: true })
  blockNumber: number;

  @Column({
    type: 'enum',
    enum: Chain,
  })
  chain: Chain;

  @Column()
  wallet: string;

  @Column({ name: 'group_name' })
  groupName: string;

  @Column({ name: 'handler_name' })
  handlerName: string;

  @Column({ name: 'channel_id' })
  channelId: string;

  @Column({
    type: 'enum',
    enum: MessengerType,
  })
  messengerType: MessengerType;

  @Column({ name: 'ack_required', default: false })
  ackRequired: boolean;

  @Column({ default: false })
  acked: boolean;

  @Column({ name: 'acked_by_user', nullable: true })
  ackedByUser: string;

  @Column({ name: 'acked_at', nullable: true })
  ackedAt: Date;

  @Column({ name: 'repeat_interval_hours', nullable: true })
  repeatIntervalHours?: number;

  @Column({ name: 'alert_notification_sent', nullable: true })
  alertNotificationSent: Date;

  @Column({ name: 'resolved_notification_sent', nullable: true })
  resolvedNotificationSent: Date;

  @Column({ default: false })
  resolved: boolean;

  @Column({ name: 'resolved_at', nullable: true })
  resolvedAt: Date;

  @Column({ name: 'resolution_notes', nullable: true })
  resolutionNotes: string;

  @Column({ name: 'resolved_message', nullable: true })
  resolvedMessage: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
