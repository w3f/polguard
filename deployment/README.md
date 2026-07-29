# Deployment

The platform uses a consolidated Docker image for all services, with different commands to run each service.

## Environments

We have two deployment environments, each with a dedicated Kubernetes namespace:

| Environment | Namespace        | Notes                                                      |
|-------------|------------------|------------------------------------------------------------|
| staging     | `polguard-stage` | Testing; the payouts CronJob is suspended (manual trigger) |
| production  | `polguard-prod`  | Runs the payouts CronJob on its regular schedule           |

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

## NPM Packages

Two packages are published to npm — `@w3f/polguard-common` and `@w3f/polguard-config`. All service packages are private.

Publishing is manual, from the package directory, using yarn:

```bash
yarn npm login          # once per session
yarn version patch      # bump (patch | minor | major)
yarn build && yarn test
yarn npm publish
```

Publish `common` before `config`, since `config` depends on it.
