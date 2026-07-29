{{/*
    Creates a monitoring.coreos.com/v1/ServiceMonitor
    req. variables:
        - .name: string
        - .global: $
*/}}
{{- define "polguard.serviceMonitor" }}
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: {{ include "common.names.fullname" .global }}-{{ .name }}
  labels: {{ include "polguard.labels" . | nindent 4 }}
spec:
  selector:
    matchLabels: {{ include "polguard.selectorLabels" . | nindent 6 }}
  endpoints:
    - port: metrics
{{- end }}
