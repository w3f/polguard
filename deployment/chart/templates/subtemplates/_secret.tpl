{{/*
    Creates a Secret
    req. variables:
        - .name: string
        - .svc: struct
        - .global $
*/}}
{{- define "foundation.web3.mp.secret" }}
apiVersion: v1
kind: Secret
type: Opaque
metadata:
  name: {{ include "common.names.fullname" .global }}-{{ .name }}-secrets
  labels: {{ include "foundation.web3.mp.common.labels" . | nindent 4 }}
stringData:
{{- range $k, $v := .svc.secrets }}
  {{ $k }}: {{ $v | quote }}
{{- end }}
{{- end }}
