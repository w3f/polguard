import { FastifyInstance } from 'fastify';
import { IncidentService } from '../incident/incident.service';
import {
  CreateIncidentSchema,
  GetIncidentsSchema,
  AcknowledgeIncidentSchema,
  ResolveByChainSchema,
  ResolveManuallySchema,
  IncidentIdParamsSchema,
  type CreateIncidentBody,
  type GetIncidentsQuery,
  type AcknowledgeIncidentBody,
  type ResolveByChainBody,
  type ResolveManuallyBody,
  type IncidentIdParams,
} from '../schemas/incident.schemas';

export function incidentRoutes(incidentService: IncidentService) {
  return async function (app: FastifyInstance) {
    app.get<{ Params: IncidentIdParams }>(
      '/incidents/:id',
      {
        schema: {
          params: IncidentIdParamsSchema,
          tags: ['incidents'],
          summary: 'Get incident by ID',
          description: 'Retrieve a specific incident by its ID with all related notifications.',
        },
      },
      async request => {
        return incidentService.findIncidentById(request.params.id);
      },
    );

    app.get<{ Querystring: GetIncidentsQuery }>(
      '/incidents',
      {
        schema: {
          querystring: GetIncidentsSchema,
          tags: ['incidents'],
          summary: 'Get incidents with filtering options',
          description: 'Retrieve incidents with various filtering options.',
        },
      },
      async request => {
        return incidentService.findIncidents(request.query);
      },
    );

    app.post<{ Body: CreateIncidentBody }>(
      '/incidents',
      {
        schema: {
          body: CreateIncidentSchema,
          tags: ['incidents'],
          summary: 'Create a new incident',
          description: 'The incident will be stored and notifications will be sent based on the configuration.',
        },
      },
      async (request, reply) => {
        const incident = await incidentService.createIncident(request.body);
        reply.status(201);
        return incident;
      },
    );

    app.post<{ Params: IncidentIdParams; Body: AcknowledgeIncidentBody }>(
      '/incidents/:id/acknowledge',
      {
        schema: {
          params: IncidentIdParamsSchema,
          body: AcknowledgeIncidentSchema,
          tags: ['incidents'],
          summary: 'Acknowledge an incident by ID',
          description: 'Mark an incident as acknowledged by a specific user.',
        },
      },
      async request => {
        return incidentService.acknowledgeIncident(request.params.id, request.body.username, request.body.channelId);
      },
    );

    app.post<{ Params: IncidentIdParams; Body: ResolveByChainBody }>(
      '/incidents/:id/resolve',
      {
        schema: {
          params: IncidentIdParamsSchema,
          body: ResolveByChainSchema,
          tags: ['incidents'],
          summary: 'Resolve an incident by ID (Chain Service)',
          description: 'Resolve an incident automatically by the chain service.',
        },
      },
      async request => {
        return incidentService.resolveIncidentByChain(request.params.id, request.body);
      },
    );

    app.post<{ Params: IncidentIdParams; Body: ResolveManuallyBody }>(
      '/incidents/:id/resolve-manual',
      {
        schema: {
          params: IncidentIdParamsSchema,
          body: ResolveManuallySchema,
          tags: ['incidents'],
          summary: 'Resolve an incident manually (Matrix Bot)',
          description: 'Manually resolve an incident via Matrix bot command.',
        },
      },
      async request => {
        return incidentService.resolveIncidentManually(request.params.id, request.body);
      },
    );
  };
}
