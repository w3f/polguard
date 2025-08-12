{{/*
    Creates labels used to uniquely match deployments, pods, and services.
    This helper extends bitnami/common's helper of the same name.
    req. variables:
        - .name: string
        - .global $
*/}}
{{- define "foundation.web3.mp.common.matchLabels" }}
{{- include "common.labels.matchLabels" .global }}
app.kubernetes.io/component: {{ .name }}
{{- end }}
