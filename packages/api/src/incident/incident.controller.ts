import { Controller, Get, Post, Body, Param, Query, Logger, HttpCode } from '@nestjs/common';
import { IncidentService } from './incident.service';
import {
  CreateIncidentDto,
  AcknowledgeIncidentDto,
  GetIncidentsDto,
  IncidentResponseDto,
  ResolveIncidentByChainDto,
  ResolveIncidentManuallyDto,
} from './dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';

@ApiTags('incidents')
@Controller('incidents')
export class IncidentController {
  private readonly logger = new Logger(IncidentController.name);

  constructor(private readonly incidentService: IncidentService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Get incident by ID',
    description: 'Retrieve a specific incident by its ID with all related notifications.',
  })
  @ApiResponse({
    status: 200,
    description: 'The incident with the specified ID',
    type: IncidentResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Incident not found',
  })
  @ApiParam({ name: 'id', description: 'Incident ID', type: 'string' })
  async getIncidentById(@Param('id') id: string): Promise<IncidentResponseDto> {
    this.logger.debug(`Getting incident ${id}`);
    const incident = await this.incidentService.findIncidentById(id);
    return incident;
  }

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
    this.logger.debug('Getting incidents.');
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
  @ApiResponse({
    status: 409,
    description: 'Block already processed',
  })
  @ApiBody({ type: CreateIncidentDto })
  async createIncident(@Body() createIncidentDto: CreateIncidentDto): Promise<IncidentResponseDto> {
    this.logger.debug('Creating new incident.');
    const incident = await this.incidentService.createIncident(createIncidentDto);
    return incident;
  }

  @Post(':id/acknowledge')
  @HttpCode(200)
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
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to acknowledge this incident',
  })
  @ApiResponse({
    status: 404,
    description: 'Incident not found',
  })
  @ApiParam({ name: 'id', description: 'Incident ID', type: 'string' })
  @ApiBody({ type: AcknowledgeIncidentDto })
  async acknowledgeIncidentById(
    @Param('id') id: string,
    @Body() acknowledgeIncidentDto: AcknowledgeIncidentDto,
  ): Promise<IncidentResponseDto> {
    this.logger.debug(`Acknowledging incident ${id}.`);
    const incident = await this.incidentService.acknowledgeIncident(
      id,
      acknowledgeIncidentDto.username,
      acknowledgeIncidentDto.channelId,
    );
    return incident;
  }

  @Post(':id/resolve')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Resolve an incident by ID (Chain Service)',
    description: `Resolve an incident automatically by the chain service when the underlying condition returns to normal.
    
Requires chain and blockNumber for block consistency check.`,
  })
  @ApiResponse({
    status: 200,
    description: 'The incident has been successfully resolved',
    type: IncidentResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Incident not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Block already processed',
  })
  @ApiParam({ name: 'id', description: 'Incident ID', type: 'string' })
  @ApiBody({ type: ResolveIncidentByChainDto })
  async resolveIncidentByChain(
    @Param('id') id: string,
    @Body() resolveDto: ResolveIncidentByChainDto,
  ): Promise<IncidentResponseDto> {
    this.logger.debug(`Resolving incident ${id} by chain service.`);
    const incident = await this.incidentService.resolveIncidentByChain(id, resolveDto);
    return incident;
  }

  @Post(':id/resolve-manual')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Resolve an incident manually (Matrix Bot)',
    description: `Manually resolve an incident via Matrix bot command.
    
Requires username and channelId for authentication and validation.`,
  })
  @ApiResponse({
    status: 200,
    description: 'The incident has been successfully resolved manually',
    type: IncidentResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to resolve this incident',
  })
  @ApiResponse({
    status: 404,
    description: 'Incident not found',
  })
  @ApiParam({ name: 'id', description: 'Incident ID', type: 'string' })
  @ApiBody({ type: ResolveIncidentManuallyDto })
  async resolveIncidentManually(
    @Param('id') id: string,
    @Body() resolveDto: ResolveIncidentManuallyDto,
  ): Promise<IncidentResponseDto> {
    this.logger.debug(`Manually resolving incident ${id} by ${resolveDto.username}.`);
    const incident = await this.incidentService.resolveIncidentManually(id, resolveDto);
    return incident;
  }
}
