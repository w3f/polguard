import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MessengerType, NotificationType } from '@w3f/monitoring-types';
import type { Incident } from './incident.entity';

@Entity('notification')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  incidentId: string;

  @ManyToOne('Incident', 'notifications')
  @JoinColumn({ name: 'incidentId' })
  incident: Incident;

  @Column()
  channelId: string;

  @Column({
    type: 'simple-enum',
    enum: MessengerType,
  })
  messengerType: MessengerType;

  @Column({ type: 'simple-enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'double precision' })
  repeatHours: number;

  @Column({ nullable: true })
  lastSentAt: Date;

  @Column({ default: false })
  isDelivered: boolean;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
