{{/* IGNORE THIS FILE FOR NOW -- IN PROGRESS */}}


{{/**/}}
{{/*Validate mandatory and conditional fields.*/}}
{{/**/}}

{{/*{{- include "common.validations$.Values.single"*/}}
{{/*      (dict "value" $.Values.config "field" "config" "context" $*/}}
{{/*            "err_msg" "You must supply $.Values.config (non-empty).") -}}*/}}

{{/*{{- if and $.Values.persistence.enabled (not $.Values.persistence.size) -}}*/}}
{{/*{{- fail "persistence.size must be set when persistence.enabled=true" -}}*/}}
{{/*{{- end -}}*/}}
{{/* todo re-add validations, look into json schema usage */}}
