{{/*
    Creates a monitoring.coreos.com/v1/ServiceMonitor
    req. variables:
        - .name: string
        - .global: $
*/}}
{{- define "foundation.web3.mp.servicemonitor" }}
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: {{ include "common.names.fullname" .global }}-{{ .name }}
  labels:
    {{ toYaml .global.monitorSettings.labels | nindent 4 }}
spec:
  selector:
    matchLabels: {{ include "foundation.web3.mp.common.matchLabels" . | nindent 6 }}
  endpoints:
    - port: {{ .global.monitorSettings.endpointPort }}
{{- end }}
