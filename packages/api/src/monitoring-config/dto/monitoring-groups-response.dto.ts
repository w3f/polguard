import { MonitoringGroup } from '@w3f/monitoring-types';
import { ApiProperty } from '@nestjs/swagger';

export class MonitoringGroupsResponseDto {
  @ApiProperty({ type: [Object], description: 'List of monitoring groups' })
  groups: MonitoringGroup[];
}
