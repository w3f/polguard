{{/*
    Creates a Deployment
    req. variables:
        - .name: string
        - .svc: struct
        - .global: $
        - .kind: 'chain' or 'api' or 'matrix'
*/}}
{{- define "polguard.deployment" }}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "common.names.fullname" .global }}-{{ .name }}
  labels: {{ include "polguard.labels" . | nindent 4 }}
spec:
  replicas: {{ .svc.replicas | default 1 }}
  revisionHistoryLimit: 3
  strategy:
    type: Recreate
  selector:
    matchLabels: {{ include "polguard.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels: {{ include "polguard.selectorLabels" . | nindent 8 }}
      annotations:
        checksum/config:  {{ toYaml .svc.config  | sha256sum }}
        checksum/secrets: {{ toYaml .svc.secrets | sha256sum }}
    spec:
      {{- with .global.Values.image.pullSecrets }}
      imagePullSecrets:
        {{- range . }}
        - name: {{ . }}
        {{- end }}
      {{- end }}

      {{- if eq .kind "chain" }}
      {{- if .global.Values.chainInitContainers }}
      initContainers:
{{ tpl (toYaml .global.Values.chainInitContainers) . | indent 8 }}
      {{- end }}
      {{- end }}
      {{- if eq .kind "incident" }}
      {{- if .global.Values.incidentInitContainers }}
      initContainers:
{{ tpl (toYaml .global.Values.incidentInitContainers) . | indent 8 }}
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

          {{- if .global.Values.probesEnabled }}
          # Every service serves GET /health on its HTTP port as soon as it is listening.
          # The matrix service only starts listening after the bot has logged in, hence the
          # generous startupProbe budget (5 min) before the liveness probe takes over.
          startupProbe:
            httpGet:
              path: /health
              port: http
            periodSeconds: 5
            failureThreshold: 60
          readinessProbe:
            httpGet:
              path: /health
              port: http
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: http
            periodSeconds: 30
            failureThreshold: 3
          {{- end }}

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
              mountPath: {{ if eq .kind "chain" }}/app/packages/chain/config{{ else if eq .kind "incident" }}/app/packages/incident/config{{ else if eq .kind "matrix" }}/app/packages/matrix/config{{ end }}
              readOnly: true
            {{- if eq .kind "chain" }}
            - name: monitoring-configs
              mountPath: /app/monitoring-configs
              readOnly: true
            {{- end }}

      volumes:
        - name: config
          configMap:
            name: {{ include "common.names.fullname" .global }}-{{ .name }}
        {{- if eq .kind "chain" }}
        - name: monitoring-configs
          persistentVolumeClaim:
            claimName: {{ include "common.names.fullname" .global }}-monitoring-configs
        {{- end }}
{{- end }}
