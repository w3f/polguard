#!/usr/bin/env bash
set -euo pipefail

usage() { echo "Usage: $0 [--cleanup]"; exit 1; }

CLEANUP=false
[[ ${1:-} ]] && { [[ $1 == "--cleanup" ]] || usage; CLEANUP=true; }

NAMESPACE=dev
RELEASE_NAME=e2e
IMAGE_TAG=local

command_exists() { command -v "$1" &>/dev/null; }

cleanup() {
  command_exists kubectl || return 0
  command_exists helm && helm -n "$NAMESPACE" list | grep -q "$RELEASE_NAME" && helm delete "$RELEASE_NAME" -n "$NAMESPACE" || true
  if kubectl get ns "$NAMESPACE" &>/dev/null; then
    kubectl -n "$NAMESPACE" delete all,cm,secret,pvc --all --grace-period=0 --force || true
    kubectl delete ns "$NAMESPACE" --wait=false || true
  fi
  command_exists kind && kind get clusters --quiet | grep -q "^dev$" && kind delete cluster --name dev || true
}

$CLEANUP && { cleanup; exit 0; }

for t in docker kind kubectl helm; do
  command_exists "$t" || { echo "$t missing"; exit 1; }
done

docker build -t web3f/monitoring-platform:"$IMAGE_TAG" .
docker build -t web3f/monitoring-platform-e2e:"$IMAGE_TAG" -f e2e/Dockerfile .

kind get clusters --quiet | grep -q "^dev$" || kind create cluster --name dev

kind load docker-image web3f/monitoring-platform:"$IMAGE_TAG" --name dev
kind load docker-image web3f/monitoring-platform-e2e:"$IMAGE_TAG" --name dev

kubectl create ns "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

helm dependency update ./e2e/chart
helm lint ./e2e/chart

helm upgrade --install "$RELEASE_NAME" ./e2e/chart \
  --create-namespace \
  -n "$NAMESPACE" \
  --set tests.image.repository=web3f/monitoring-platform-e2e \
  --set tests.image.tag="$IMAGE_TAG" \
  --set tests.image.pullPolicy=IfNotPresent \
  --set mp-api.image.tag="$IMAGE_TAG" \
  --set mp-api.secrets.GITLAB_TOKEN="$GITLAB_TOKEN" \
  --set mp-matrix.image.tag="$IMAGE_TAG" \
  --set mp-matrix.secrets.MATRIX_PASSWORD="$MATRIX_PASSWORD" \
  --set mp-chain.image.tag="$IMAGE_TAG" \
  --set secrets.MATRIX_PASSWORD="$MATRIX_PASSWORD" \
  --set secrets.GITLAB_TOKEN="$GITLAB_TOKEN" \
  --wait

helm test "$RELEASE_NAME" -n "$NAMESPACE"
