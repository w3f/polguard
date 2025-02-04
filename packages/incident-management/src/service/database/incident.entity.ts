import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Chain } from '@w3f/monitoring-types';

@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'incident_id', unique: true })
  incidentId: string;

  @Column()
  message: string;

  @Column({ name: 'block_number' })
  blockNumber: number;

  @Column({
    type: 'enum',
    enum: Chain,
  })
  chain: Chain;

  @Column({ name: 'acknowledgement_required', default: false })
  acknowledgementRequired: boolean;

  @Column({ name: 'acknowledged', default: false })
  acknowledged: boolean;

  @Column({ name: 'repeat_interval_hours', nullable: true })
  repeatIntervalHours?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'acknowledged_at', nullable: true })
  acknowledgedAt?: Date;
}
