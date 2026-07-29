{{/*
    Creates labels used to uniquely match components.
    The resulting labels is a subset of "polguard.labels".
    This helper extends bitnami/common's helper.
    req. variables:
        - .name: string
        - .global $
*/}}
{{- define "polguard.selectorLabels" }}
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
{{- define "polguard.labels" }}
{{- include "common.labels.standard" .global }}
app.kubernetes.io/component: {{ .name }}
{{- end }}

{{/*
    Returns a chain service, with `chainDefaults` merged underneath it. Every chain
    service shares the same config apart from `chain`, so the common parts are set once
    in chainDefaults; anything the chain sets itself wins.
    req. variables:
        - .svc: struct (one chainServices entry)
        - .global: $
*/}}
{{- define "polguard.chainSvc" -}}
{{- toYaml (mergeOverwrite (deepCopy (.global.Values.chainDefaults | default dict)) .svc) -}}
{{- end }}
