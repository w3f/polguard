{{/*
    Creates a Deployment
    req. variables:
        - .name: string
        - .svc: struct
        - .global: $
        - .kind: 'chain' or 'api' or 'matrix'
*/}}
{{- define "foundation.web3.mp.deployment" }}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "common.names.fullname" .global }}-{{ .name }}
  labels: {{ include "foundation.web3.mp.common.labels" . | nindent 4 }}
spec:
  replicas: {{ .svc.replicas | default 1 }}
  revisionHistoryLimit: 3
  strategy:
    type: Recreate
  selector:
    matchLabels: {{ include "foundation.web3.mp.common.matchLabels" . | nindent 6 }}
  template:
    metadata:
      labels: {{ include "foundation.web3.mp.common.matchLabels" . | nindent 8 }}
      annotations:
        checksum/config:  {{ toYaml .svc.config  | sha256sum }}
        checksum/secrets: {{ toYaml .svc.secrets | sha256sum }}
    spec:
{{- /*      {{- with (include "common.images.renderPullSecrets" (dict "images" (list .global.Values.image) "context" .)) }}*/ -}}
{{- /*      imagePullSecrets:*/ -}}
{{- /*{{ . | indent 8 }}*/ -}}
{{- /*      {{- end }}*/ -}}

      {{- if eq .kind "chain" }}
      {{- if .global.Values.chainInitContainers }}
      initContainers:
{{ tpl (toYaml .global.Values.chainInitContainers) . | indent 8 }}
      {{- end }}
      {{- end }}
      {{- if eq .kind "api" }}
      {{- if .global.Values.apiInitContainers }}
      initContainers:
{{ tpl (toYaml .global.Values.apiInitContainers) . | indent 8 }}
      {{- end }}
      {{- end }}
      {{- if eq .kind "matrix" }}
      {{- if .global.Values.matrixInitContainers }}
      initContainers:
{{ tpl (toYaml .global.Values.matrixInitContainers) . | indent 8 }}
      {{- end }}
      {{- end }}

      containers:
        - name: {{ include "common.names.fullname" .global }}-{{ .name }}
          image: {{ .global.Values.image.repository }}:{{ .global.Values.image.tag | default "latest" }}
          imagePullPolicy: {{ .global.Values.image.pullPolicy | default "IfNotPresent" }}
          args: {{ toYaml .svc.containerArgs | nindent 12 }}

          ports:
            - name: http
              containerPort: {{ .svc.containerHttpPort | default 3000 }}
              protocol: TCP
            - name: metrics
              containerPort: {{ .svc.containerMetricsPort | default 9464 }}
              protocol: TCP

          {{- /* todo re-add probes */ -}}

          {{- if .svc.secrets }}
          envFrom:
            - secretRef:
                name: {{ include "common.names.fullname" .global }}-{{ .name }}-secrets
          {{- end }}

          resources:
          {{- $customResources := .svc.resources | default false }}
          {{- if $customResources }}
{{ toYaml .svc.resources | indent 12 }}
          {{- else }}
{{ toYaml .global.Values.resources | indent 12 }}
          {{- end }}

          volumeMounts:
            - name: config
              mountPath: {{ if eq .kind "chain" }}/app/packages/chain/config{{ else if eq .kind "api" }}/app/packages/api/config{{ else if eq .kind "matrix" }}/app/packages/matrix/config{{ end }}
              readOnly: true
            {{- if eq .kind "matrix" }}
            - name: data
              mountPath: /app/packages/matrix/data
            {{- end }}
            - name: monitoring-configs
              mountPath: /app/monitoring-configs
              readOnly: true

      volumes:
        - name: config
          configMap:
            name: {{ include "common.names.fullname" .global }}-{{ .name }}
        {{- if eq .kind "matrix" }}
        - name: data
          persistentVolumeClaim:
            claimName: {{ include "common.names.fullname" .global }}-{{ .name }}
        {{- end }}
        - name: monitoring-configs
          persistentVolumeClaim:
            claimName: {{ include "common.names.fullname" .global }}-monitoring-configs
{{- end }}
