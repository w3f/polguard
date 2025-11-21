# Deployment

The platform uses a consolidated Docker image for all services, with different commands to run each service.

## Environments

We have three deployment environments:

- **staging** - Staging environment for testing
- **production** - Production environment
- **production-oncall** - Production environment with higher criticality (currently used only for Finance)

## Kubernetes Namespaces

Each environment corresponds to a dedicated Kubernetes namespace in the engineering cluster:

- `monitoring-stage`
- `monitoring-prod`
- `monitoring-oncall`

Engineering ArgoCD: https://argocd.w3f.tech/applications

## CI/CD Pipeline

### CircleCI

CircleCI handles the build and release process:

- Builds and pushes Docker images with SHA tags for every commit
- Tags images as `master` and `latest` for master branch commits
- For release tags (vX.Y.Z), retags and pushes images with the version tag
- Publishes Helm charts to the chart repository

### Docker Images

Images are published to Docker Hub under `web3f/polguard` with the following tagging strategy:

- `${CIRCLE_SHA1}` - Every commit
- `master`, `latest` - Master branch commits
- `vX.Y.Z` - Release tags

## ArgoCD Deployment

Deployments are handled via ArgoCD using the "app of apps" pattern.

The ArgoCD configuration is maintained in a separate repository:
https://gitlab.w3f.tech/infrastructure/argocd-deployment/-/tree/master/apps

**Currently, there is no automation for updating image tags in environments.** Image tags must be updated manually for each environment in the ArgoCD configuration repository.

In the future, we are considering implementing automation using ArgoCD Image Updater or other solutions (TBD).

## Helm Charts

Helm charts are published to the W3F chart repository as part of the CI pipeline:
https://github.com/w3f/helm-charts/tree/gh-pages

The `publish-chart.sh` script is automatically triggered by CircleCI when a release tag is created.
