import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

/**
 * Creates and returns an OpenTelemetry SDK instance.
 *
 * The created instance is configured to export traces to the console, and metrics to Prometheus at `:9464/metrics`.
 * Additionally, a SIGTERM listener is registered to shut down the instance once a SIGTERM is received.
 *
 * @param enableTraces enables traces which are exported to the console STDOUT.
 * @param enableMetrics enables metrics, a Prometheus metrics server, and exports the metrics to the metrics server.
 */
export const buildOtelSdk = (enableTraces: boolean = true, enableMetrics: boolean = true): NodeSDK => {
  const otelSdk = new NodeSDK({
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
