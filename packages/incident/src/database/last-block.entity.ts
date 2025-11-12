import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Chain } from '@w3f/monitoring-common';

@Entity()
export class LastBlock {
  @PrimaryColumn({ type: 'simple-enum', enum: Chain })
  chain: Chain;

  @Column()
  blockNumber: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
