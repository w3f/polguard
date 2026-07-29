{{/*
    Creates a Service
    req. variables:
        - .name: string
        - .svc: struct
        - .global $
*/}}
{{- define "polguard.service" }}
apiVersion: v1
kind: Service
metadata:
  name: {{ include "common.names.fullname" .global }}-{{ .name }}
  labels: {{ include "polguard.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  ports:
    - name: http
      port: {{ .svc.serviceHttpPort | default 80 }}
      targetPort: http
    - name: metrics
      port: {{ .svc.serviceMetricsPort | default 9464 }}
      targetPort: metrics
  selector: {{ include "polguard.selectorLabels" . | nindent 4 }}
{{- end }}
