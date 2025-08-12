{{/*
    Creates a Secret
    req. variables:
        - .name: string
        - .svc: struct
        - .global $
*/}}
{{- define "foundation.web3.mp.service" }}
apiVersion: v1
kind: Service
metadata:
  name: {{ include "common.names.fullname" .global }}-{{ .name }}
  labels: {{ include "common.labels.standard" .global | nindent 4 }}
spec:
  type: ClusterIP
  ports:
    - name: http
      port: {{ .svc.servicePort | default 80 }}
      targetPort: http
  selector: {{ include "foundation.web3.mp.common.matchLabels" . | nindent 4 }}
{{- end }}
