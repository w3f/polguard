import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { Chain } from '@core/constants';

@Entity()
@Unique({ properties: ['chain'] })
export class BlockTracker {
  @PrimaryKey()
  id!: number;

  @Property({ type: 'string' })
  chain!: Chain;

  @Property()
  block!: number;
}
