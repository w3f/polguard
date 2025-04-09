import { Controller, Get, Post, Body, Param, Query, Logger } from '@nestjs/common';
import { IncidentService } from './incident.service';
import {
  CreateIncidentDto,
  AcknowledgeIncidentDto,
  ResolveIncidentDto,
  GetIncidentsDto,
  IncidentResponseDto,
} from './dto';

@Controller('incidents')
export class IncidentController {
  private readonly logger = new Logger(IncidentController.name);

  constructor(private readonly incidentService: IncidentService) {}

  @Get()
  async getIncidents(@Query() query: GetIncidentsDto): Promise<IncidentResponseDto[]> {
    this.logger.debug('Getting incidents with filters');
    const incidents = await this.incidentService.findIncidents(query);
    return incidents;
  }

  @Post()
  async createIncident(@Body() createIncidentDto: CreateIncidentDto): Promise<IncidentResponseDto> {
    this.logger.debug('Creating new incident');
    const incident = await this.incidentService.createIncident(createIncidentDto);
    return incident;
  }

  @Post(':id/acknowledge')
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
  async resolveIncidentById(
    @Param('id') id: number,
    @Body('resolvedMessage') resolvedMessage?: string,
  ): Promise<IncidentResponseDto> {
    this.logger.debug(`Resolving incident ${id} by ID`);
    const incident = await this.incidentService.resolveIncidentById(id, resolvedMessage);
    return incident;
  }

  @Post('resolve')
  async resolveIncident(@Body() resolveIncidentDto: ResolveIncidentDto): Promise<IncidentResponseDto> {
    this.logger.debug(`Resolving incident for ${resolveIncidentDto.wallet}`);
    const incident = await this.incidentService.resolveIncident(resolveIncidentDto);
    return incident;
  }
}
