import os from "node:os";
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_SERVICE_INSTANCE_ID,
  SEMRESATTRS_CONTAINER_ID,
} from '@opentelemetry/semantic-conventions';
import { NodeSDK } from '@opentelemetry/sdk-node';

export interface OtelOptions {
  enableTraces?: boolean;
  enableMetrics?: boolean;
  metricsPort?: number;
}

/**
 * Creates and returns an OpenTelemetry SDK instance.
 *
 * The created instance is configured to export metrics to Prometheus at the specified port (default: 9464).
 * Traces are currently disabled but can be enabled in the future with OTLP exporter.
 * 
 * Note: The calling service is responsible for shutting down the SDK (e.g., in SIGTERM handler).
 *
 * @param serviceName the name of the service, e.g. "polguard-incident" or "polguard-chain"; usually taken from package.json
 * @param serviceVersion the version of the service, e.g. "1.0.1"; usually taken from package.json
 * @param enableTraces enables traces (currently not implemented - reserved for future OTLP exporter)
 * @param enableMetrics enables metrics and Prometheus metrics server
 * @param metricsPort the port for the Prometheus metrics server (default: 9464)
 */
export const buildOtelSdk = (
  serviceName: string, 
  serviceVersion?: string, 
  enableTraces: boolean = false, 
  enableMetrics: boolean = true,
  metricsPort: number = 9464
): NodeSDK => {
  const hostname = os.hostname();

  let metricReader;
  if (enableMetrics) {
    try {
      metricReader = new PrometheusExporter({ port: metricsPort });
    } catch (error) {
      console.error(`Failed to initialize Prometheus exporter on port ${metricsPort}:`, error);
      throw error;
    }
  }

  const otelSdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion ?? 'unknown',
      [ATTR_SERVICE_INSTANCE_ID]: hostname,
      [SEMRESATTRS_CONTAINER_ID]: hostname, // will be updated to ATTR_CONTAINER_ID in the future
    }),
    // TODO: Add OTLP trace exporter when distributed tracing is needed
    // Required dependency: @opentelemetry/exporter-trace-otlp-http
    traceExporter: undefined,
    metricReader,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  return otelSdk;
};
