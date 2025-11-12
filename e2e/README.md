# End-to-End Tests for Monitoring Platform

This directory contains end-to-end tests for the Monitoring Platform. These tests verify the complete flow from chain events to API incidents to Matrix notifications.

## Directory Structure

```
e2e/
├── Dockerfile            # Docker image for running e2e tests
├── chart/                # Helm chart for deploying e2e tests in Kubernetes
├── docker-compose.yml    # Docker Compose for local development
├── scripts/              # Utility scripts for running tests locally
└── src/                  # Source code for e2e tests
```

## Overview

The e2e tests follow this scenario:

1. Wait for the Chain service to process a specific block number
2. Check if the Incident service has created incidents with a specific handler type
3. Verify that Matrix service sent notifications to the specific room with the expected message pattern

## Prerequisites

- Docker
- KinD (Kubernetes in Docker)
- Helm
- kubectl

## Configuration

The e2e tests are configured using the `e2e/configs/e2e.yaml` file. This file contains settings for:

- Chain service: URL and target block number
- Incident service: URL and incident handler type to check for
- Matrix service: Homeserver URL, room ID, and message pattern to look for

## Required Environment Variables

For CI and local testing, the following environment variables are required:

```bash
export MATRIX_TOKEN="your-matrix-token"  # Required for Matrix authentication
export GITLAB_TOKEN="your-gitlab-token"  # Required for Incident service
```

## Running Tests Locally

### Using KinD

To run the full e2e tests in a Kubernetes environment, use the provided script:

```bash
./e2e/scripts/run-e2e-local.sh
```

This script will:
1. Check for required tools (Docker, KinD, kubectl, Helm)
2. Build Docker images for the monitoring platform and e2e tests
3. Create a KinD cluster (or use an existing one)
4. Load the Docker images into the KinD cluster
5. Create necessary Kubernetes secrets
6. Update Helm dependencies for both the deployment chart and e2e chart
7. Deploy the e2e chart with all components (API, Chain, Matrix, PostgreSQL)
8. Run the e2e tests

## CI/CD Integration

The e2e tests are integrated into the CircleCI pipeline in the `end_to_end_tests` job. The CI pipeline uses the same Helm chart from `e2e/chart` to deploy and run the tests.

## Troubleshooting

If the tests fail, check the logs:

```bash
# For local tests
kubectl -n dev logs -l app.kubernetes.io/instance=monitoring-e2e

# For CI tests
kubectl -n e2e logs -l app.kubernetes.io/instance=e2e-<job-id>
```

## Debugging KinD in CircleCI

If an e2e test job fails, you can inspect the KinD cluster:

1. **Rerun job with SSH** in the CircleCI UI.
2. **Shell into the control-plane node**:
```bash
docker exec -it ci-control-plane bash
crictl ps -a
crictl pods
crictl logs <CID>
```
