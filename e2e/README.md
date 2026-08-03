# End-to-End Tests

Runs the full stack in a KinD cluster via the Helm chart in [`chart/`](chart), and verifies the
whole path from a chain event to a Matrix notification.

## What it checks

1. The Chain service processes a specific block.
2. The Incident service creates an incident with the expected handler type.
3. The Matrix service posts a matching message to the alert room.
4. An unacknowledged incident escalates to the escalation room.

Because it replays a fixed block, the expected incident is deterministic.

## Configuration

Everything lives in [`chart/values.yaml`](chart/values.yaml):

| Key | Holds |
|-----|-------|
| `tests.config` | target block, expected handler type, message patterns, Matrix room IDs |
| `polguard.*` | the stack under test — chain, incident and matrix service config |
| `polguard.configFetcher.repos` | the monitoring config repo supplying the rules |

`tests.config` is rendered into a ConfigMap and read by the test pod. Credentials are the only
thing not in the file — they're passed in at install time.

## Running locally

Needs Docker, KinD, Helm and kubectl, plus:

```bash
export MATRIX_TOKEN=""                   # access token for the bot session
export MATRIX_DEVICE_ID=""               # device ID for that same session
export CONFIG_REPO_DEPLOY_KEY_BASE64=""  # base64 read-only deploy key for the config repo
```

```bash
./e2e/scripts/run-e2e-local.sh            # build, create cluster, install, test
./e2e/scripts/run-e2e-local.sh --cleanup  # tear down and exit
```

The script builds both images, creates a KinD cluster named `dev`, loads the images, installs the
chart and runs `helm test`.

## In CI

[`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml) is a reusable workflow called from
`ci.yml` in two modes:

| Trigger | Image | Why |
|---------|-------|-----|
| `master` | pulls the just-pushed `:<sha>` | tests the exact artifact that gets promoted |
| `workflow_dispatch` | builds locally, pushes nothing | pre-merge coverage on a branch |

It never runs on fork pull requests, since it needs secrets.
