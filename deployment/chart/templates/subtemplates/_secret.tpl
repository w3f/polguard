{{/*
    Creates a Secret
    req. variables:
        - .name: string
        - .svc: struct
        - .global $
*/}}
{{- define "polguard.secret" }}
apiVersion: v1
kind: Secret
type: Opaque
metadata:
  name: {{ include "common.names.fullname" .global }}-{{ .name }}-secrets
  labels: {{ include "polguard.labels" . | nindent 4 }}
stringData:
{{- range $k, $v := .svc.secrets }}
  {{ $k }}: {{ $v | quote }}
{{- end }}
{{- end }}
