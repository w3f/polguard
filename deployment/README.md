# Deployment

This directory contains deployment configurations for the Monitoring Platform.

## Overview

The Monitoring Platform supports three deployment flows:

1. **Local Development**: Using Docker Compose for local testing
2. **Manual Test Deployment**: Using Helmfile to deploy to a test namespace
3. **Production Deployment**: Using ArgoCD for managed deployments

The platform now uses a consolidated Docker image for all services, with different commands to run each service.

## Development Flow: Local

For local development and testing, use the Docker Compose setup:

```bash
# Start all services
docker-compose up -d

# Or start a specific service
docker-compose up -d api
```

This will start all required services:
- API service
- Chain service
- Matrix service
- Telemetry service
- Redis
- PostgreSQL

All services use the same Docker image (defined in the root Dockerfile) but with different commands to run each service. The Docker Compose configuration references this Dockerfile directly for local development.

The `configs` directory contains example configurations used by Docker Compose for local development. The Docker Compose setup is only used for local development and is not intended for production use.

## Development Flow: Manual Test Deployment

For manual deployment to the test environment, use Helmfile:

```bash
# Deploy to test namespace
helmfile -f helmfile.d/ --environment test apply
```

This is a temporary solution for testing deployments. In the future, CI/CD will handle staging and production environments.

## Production Flow

Production deployments use Helm charts and ArgoCD:

1. The `charts` directory contains Helm charts for each service
2. Deployment to production is handled via ArgoCD
3. The deployment process is managed through the ArgoCD interface or CLI

The ArgoCD configuration is maintained in a separate repository:
https://gitlab.w3f.tech/infrastructure/argocd-deployment

## Directory Structure

- `charts/`: Helm charts for each service
  - `api/`: API service chart
  - `chain/`: Chain service chart
  - `matrix/`: Matrix service chart
  - `telemetry/`: Telemetry service chart
- `configs/`: Example configurations used by Docker Compose
- `helmfile.d/`: Helmfile configurations
  - `config/`: Values files for Helmfile
- `scripts/`: Utility scripts
