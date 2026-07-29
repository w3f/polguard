{{/*
    Creates a PersistantVolumeClaim (PVC)
    req. variables:
        - .name: string
        - .persistence: persistence struct
        - .global $

*/}}
{{- define "polguard.pvc" }}
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {{ include "common.names.fullname" .global }}-{{ .name }}
  labels: {{ include "polguard.labels" . | nindent 4 }}
spec:
  accessModes: {{ toYaml .persistence.accessModes | nindent 4 }}
  resources:
    requests:
      storage: {{ .persistence.size }}
  {{- if .persistence.storageClass }}
  storageClassName: {{ .persistence.storageClass }}
  {{- end }}
{{- end }}

