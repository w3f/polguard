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
  labels: {{ include "foundation.web3.mp.common.labels" . | nindent 4 }}
spec:
  selector:
    matchLabels: {{ include "foundation.web3.mp.common.matchLabels" . | nindent 6 }}
  endpoints:
    - port: metrics
{{- end }}
