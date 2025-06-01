# Deployment

The platform now uses a consolidated Docker image for all services, with different commands to run each service.

## Development Flow

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
- PostgreSQL

All services use the same Docker image (defined in the root Dockerfile) but with different commands to run each service. The Docker Compose configuration references this Dockerfile directly for local development.

The `configs` directory contains example configurations used by Docker Compose for local development. The Docker Compose setup is only used for local development and is not intended for production use.

## Production Flow

Production deployments use Helm chart and ArgoCD. The `chart` directory contains a unified Helm chart for the monitoring platform.
Deployment to production is handled via ArgoCD.

The ArgoCD configuration is maintained in a separate repository:
https://gitlab.w3f.tech/infrastructure/argocd-deployment
