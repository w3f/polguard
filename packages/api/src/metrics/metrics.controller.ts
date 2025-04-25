import { Controller, Get } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private metricsService: MetricsService) {}

  @Get()
  @ApiOperation({ summary: 'Get Prometheus metrics' })
  @ApiResponse({
    status: 200,
    description: 'Returns Prometheus metrics in text format',
  })
  async getMetrics() {
    return this.metricsService.getMetrics();
  }
}
