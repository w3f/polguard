{{/*
    Creates a configmap
    req. variables:
        - .name: string
        - .svc: struct
        - .global $
*/}}
{{- define "foundation.web3.mp.configmap" }}
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "common.names.fullname" .global }}-{{ .name }}
  labels: {{ include "common.labels.standard" .global | nindent 4 }}
data:
  config.yaml: |-
    {{- toYaml .svc.config | nindent 4 }}
{{- end }}
