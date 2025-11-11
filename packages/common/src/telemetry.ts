import os from "node:os";
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  SEMRESATTRS_SERVICE_INSTANCE_ID,
  SEMRESATTRS_CONTAINER_ID,
} from '@opentelemetry/semantic-conventions';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import {TELEMETRY_PREFIX} from "./constants";

/**
 * Creates and returns an OpenTelemetry SDK instance.
 *
 * The created instance is configured to export traces to the console, and metrics to Prometheus at `:9464/metrics`.
 * Additionally, a SIGTERM listener is registered to shut down the instance once a SIGTERM is received.
 *
 * @param serviceName the name of the service, e.g. "monitoring-api" or "monitoring-chain"; usually taken from package.json
 * @param serviceVersion the version of the service, e.g. "1.0.1"; usually taken from package.json
 * @param chain if this instance is a monitoring-chain instance, which chain is it monitoring (e.g. kusama, asset-hub, etc.)
 * @param enableTraces enables traces which are exported to the console STDOUT.
 * @param enableMetrics enables metrics, a Prometheus metrics server, and exports the metrics to the metrics server.
 */
export const buildOtelSdk = (serviceName: string, serviceVersion?: string, chain?: string, enableTraces: boolean = true, enableMetrics: boolean = true): NodeSDK => {
  const hostname = os.hostname();

  const otelSdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion ?? 'unknown',
      [SEMRESATTRS_SERVICE_INSTANCE_ID]: hostname, // will be updated to ATTR_SERVICE_INSTANCE_ID in the future
      [SEMRESATTRS_CONTAINER_ID]: hostname, // will update to ATTR_CONTAINER_ID in the future
      [`${TELEMETRY_PREFIX}.chain`]: chain ?? undefined,
    }),
    traceExporter: !enableTraces ? undefined : new ConsoleSpanExporter(),
    metricReader: !enableMetrics ? undefined : new PrometheusExporter({
      port: 9464,
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  process.on('SIGTERM', () => {
    console.debug('Shutting down OpenTelemetry SDK.')
    otelSdk.shutdown().then(
      () => console.debug('OpenTelemetry SDK shut down successfully.'),
      err => console.error('Error shutting down OpenTelemetry SDK.', err),
    );
  });

  return otelSdk;
};
