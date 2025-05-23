import { Controller, Get, Post, Body, Param, Query, Logger } from '@nestjs/common';
import { IncidentService } from './incident.service';
import { CreateIncidentDto, AcknowledgeIncidentDto, GetIncidentsDto, IncidentResponseDto } from './dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';

@ApiTags('incidents')
@Controller('incidents')
export class IncidentController {
  private readonly logger = new Logger(IncidentController.name);

  constructor(private readonly incidentService: IncidentService) {}

  @Get()
  @ApiOperation({
    summary: 'Get incidents with filtering options',
    description: `Retrieve incidents with various filtering options.

There are two types of incidents:
- One-time incidents: Triggered once and resolved immidiately
- Firing incidents: Continuously active until the underlying issue is resolved

Filters:
- Filter by status (open, acked, unacked)
- Filter by date range (createdAfter, createdBefore)
- Filter by blockchain network (chain)
- Filter by account address, group ID, handler type, or channel ID
- Filter by acknowledgment status (needsAck, isAcked)
- Filter by resolution status (isResolved)

Used by the notification service (Matrix) to display incidents.`,
  })
  @ApiResponse({
    status: 200,
    description: 'List of incidents matching the filter criteria',
    type: [IncidentResponseDto],
  })
  async getIncidents(@Query() query: GetIncidentsDto): Promise<IncidentResponseDto[]> {
    this.logger.debug('Getting incidents');
    const incidents = await this.incidentService.findIncidents(query);
    return incidents;
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new incident',
    description: `The incident will be stored and notifications will be sent based on the configuration.

Used by Watcher service to automatically create incidents when issues are detected.`,
  })
  @ApiResponse({
    status: 201,
    description: 'The incident has been successfully created',
    type: IncidentResponseDto,
  })
  @ApiBody({ type: CreateIncidentDto })
  async createIncident(@Body() createIncidentDto: CreateIncidentDto): Promise<IncidentResponseDto> {
    this.logger.debug('Creating new incident');
    const incident = await this.incidentService.createIncident(createIncidentDto);
    return incident;
  }

  @Post(':id/acknowledge')
  @ApiOperation({
    summary: 'Acknowledge an incident by ID',
    description: `Mark an incident as acknowledged by a specific user.

Used by the notification service (Matrix) for incident acknowledgment.`,
  })
  @ApiResponse({
    status: 200,
    description: 'The incident has been successfully acknowledged',
    type: IncidentResponseDto,
  })
  @ApiParam({ name: 'id', description: 'Incident ID', type: 'number' })
  @ApiBody({ type: AcknowledgeIncidentDto })
  async acknowledgeIncidentById(
    @Param('id') id: number,
    @Body() acknowledgeIncidentDto: AcknowledgeIncidentDto,
  ): Promise<IncidentResponseDto> {
    this.logger.debug(`Acknowledging incident ${id}`);
    const incident = await this.incidentService.acknowledgeIncident(
      id,
      acknowledgeIncidentDto.username,
      acknowledgeIncidentDto.channelId,
    );
    return incident;
  }

  @Post(':id/resolve')
  @ApiOperation({
    summary: 'Resolve an incident by ID',
    description: `Used for testing purposes.`,
  })
  @ApiResponse({
    status: 200,
    description: 'The incident has been successfully resolved',
    type: IncidentResponseDto,
  })
  @ApiParam({ name: 'id', description: 'Incident ID', type: 'number' })
  async resolveIncidentById(@Param('id') id: number): Promise<IncidentResponseDto> {
    this.logger.debug(`Resolving incident ${id} by ID`);
    const incident = await this.incidentService.resolveIncidentById(id);
    return incident;
  }
}
