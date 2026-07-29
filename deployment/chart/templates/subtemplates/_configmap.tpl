{{/*
    Creates a configmap
    req. variables:
        - .name: string
        - .svc: struct
        - .global $
*/}}
{{- define "polguard.configmap" }}
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "common.names.fullname" .global }}-{{ .name }}
  labels: {{ include "polguard.labels" . | nindent 4 }}
data:
  config.yaml: |-
    {{- toYaml .svc.config | nindent 4 }}
{{- end }}
