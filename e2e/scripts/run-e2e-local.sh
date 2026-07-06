#!/usr/bin/env bash

# run the e2e tests locally
# required env vars:
#  - CONFIG_REPO_DEPLOY_KEY_BASE64: base64-encoded read-only SSH deploy key for the monitoring config repo
#  - MATRIX_TOKEN:      a token for a matrix session. This must currently be created manually.
#  - MATRIX_DEVICE_ID:  a device ID for the same session that the MATRIX_TOKEN is for
#
# Note: MATRIX_TOKEN and MATRIX_DEVICE_ID can be created by running the matrix service locally and looking in the following dir:
#   ${project_root}/packages/matrix/data
#


set -euo pipefail

usage() { echo "Usage: $0 [--cleanup]"; exit 1; }

CLEANUP=false
[[ ${1:-} ]] && { [[ $1 == "--cleanup" ]] || usage; CLEANUP=true; }

NAMESPACE=e2e
RELEASE_NAME=e2e
IMAGE_TAG=local

echo "NAMESPACE=${NAMESPACE}"
echo "RELEASE_NAME=${RELEASE_NAME}"
echo "IMAGE_TAG=${IMAGE_TAG}"
echo "MATRIX_TOKEN=${MATRIX_TOKEN}"
echo "MATRIX_DEVICE_ID=${MATRIX_DEVICE_ID}"

command_exists() { command -v "$1" &>/dev/null; }

cleanup() {
  command_exists kubectl || return 0
  if command_exists helm; then
    for release in $(helm -n "$NAMESPACE" list -q); do
      helm delete "$release" -n "$NAMESPACE" || true
    done
  fi
  if kubectl get ns "$NAMESPACE" &>/dev/null; then
    kubectl -n "$NAMESPACE" delete all,cm,secret,pvc --all --grace-period=0 --force || true
    kubectl delete ns "$NAMESPACE" --wait=false || true
  fi
  command_exists kind && kind get clusters --quiet | grep -q "^dev$" && kind delete cluster --name dev || true
}

cleanup

$CLEANUP && { exit 0; }

for t in docker kind kubectl helm; do
  command_exists "$t" || { echo "$t missing"; exit 1; }
done

docker build -t web3f/polguard:"$IMAGE_TAG" .
docker build -t web3f/polguard-e2e:"$IMAGE_TAG" -f e2e/Dockerfile .

kind get clusters --quiet | grep -q "^dev$" || kind create cluster --name dev

kind load docker-image web3f/polguard:"$IMAGE_TAG" --name dev
kind load docker-image web3f/polguard-e2e:"$IMAGE_TAG" --name dev

kubectl create ns "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

helm dependency update ./deployment/chart
helm dependency update ./e2e/chart
helm lint ./e2e/chart

echo "$CONFIG_REPO_DEPLOY_KEY_BASE64" | tr -d '\n' > /tmp/deploy_key

helm upgrade --install "$RELEASE_NAME" ./e2e/chart \
              -n "$NAMESPACE" --create-namespace \
              --set tests.image.repository=web3f/polguard-e2e \
              --set tests.image.tag=${IMAGE_TAG} \
              --set polguard.image.tag=${IMAGE_TAG} \
              --set-file polguard.configFetcher.sshPrivateKeyBase64=/tmp/deploy_key \
              --set polguard.matrixService.config.matrix.tokenAuth.deviceId=${MATRIX_DEVICE_ID} \
              --set tests.config.matrix.tokenAuth.deviceId=${MATRIX_DEVICE_ID} \
              --set polguard.matrixService.secrets.MATRIX_TOKEN=${MATRIX_TOKEN} \
              --set secrets.MATRIX_TOKEN=${MATRIX_TOKEN} \
              --wait \
              --debug

helm test "$RELEASE_NAME" -n "$NAMESPACE"
