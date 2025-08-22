{{/*
    Creates labels used to uniquely match components.
    The resulting labels is a subset of "foundation.web3.mp.common.labels".
    This helper extends bitnami/common's helper.
    req. variables:
        - .name: string
        - .global $
*/}}
{{- define "foundation.web3.mp.common.matchLabels" }}
{{- include "common.labels.matchLabels" .global }}
app.kubernetes.io/component: {{ .name }}
{{- end }}

{{/*
    Creates labels for components.
    This helper extends bitnami/common's helper.
    req. variables:
        - .name: string
        - .global $
*/}}
{{- define "foundation.web3.mp.common.labels" }}
{{- include "common.labels.standard" .global }}
app.kubernetes.io/component: {{ .name }}
{{- end }}
