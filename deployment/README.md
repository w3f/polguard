# Deployment

All services ship in a single Docker image; each runs the same image with a different command
(`start:chain`, `start:incident`, `start:matrix`, `start:payouts`).

## Docker images

Published to Docker Hub as [`web3f/polguard`](https://hub.docker.com/r/web3f/polguard):

| Tag | Published on |
|-----|--------------|
| `<sha>` | every commit to `master` |
| `master`, `latest` | `master`, after E2E passes |
| `vX.Y.Z` | release tags |

Release tags don't rebuild — they retag the already-tested `<sha>` image, so the artifact you
run is the one that passed E2E.

## Helm chart

The chart in [`chart/`](chart) deploys the full platform: chain services (one set per monitored
chain), the incident and matrix services, an optional payouts CronJob, and a git-sync sidecar
that clones your monitoring config repos onto a shared volume.

It's published to the [W3F chart repository](https://github.com/w3f/helm-charts/tree/gh-pages)
on every `master` build:

```bash
helm repo add w3f https://w3f.github.io/helm-charts
helm install polguard w3f/polguard -f your-values.yaml
```

[`chart/values.schema.json`](chart/values.schema.json) is the authoritative reference for what
you can set — the chart refuses to install on values that don't validate against it.
[`chart/values.yaml`](chart/values.yaml) documents the defaults inline.

You'll need to supply, at minimum:

- `chainServices` — one entry per chain to monitor, each with its RPC endpoint
- `incidentService.config` / `matrixService.config` — runtime config (see each service's README)
- `configFetcher.repos` — the git repos holding your monitoring rules, with a deploy key per repo
- a PostgreSQL instance for the incident service

Prometheus `ServiceMonitor`s and alerting rules are rendered by default; disable with
`serviceMonitorsEnabled: false` and `prometheusRulesEnabled: false` if you don't run the
Prometheus operator. Reference Grafana dashboards are in [`grafana/`](grafana).

## CI

GitHub Actions ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) is trust-separated:

- **Pull requests** — lint, build, unit and integration tests.
- **`master`** — push the `<sha>` image, run E2E against that exact image, promote
  `master`/`latest` and publish the chart.
- **Release tags** — retag the tested image and create a GitHub Release.

E2E ([`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml)) provisions a KinD cluster and
installs the chart. It needs a Matrix account and a monitoring-config repo, supplied via
secrets — see [`e2e/README.md`](../e2e/README.md).

## NPM packages

Two packages are published for reuse: `@w3f/polguard-common` and `@w3f/polguard-config`. The
service packages aren't published.

Publishing is manual, from the package directory:

```bash
yarn npm login          # once per session
yarn version patch      # bump (patch | minor | major)
yarn build && yarn test
yarn npm publish
```

Publish `common` before `config`, since `config` depends on it.
