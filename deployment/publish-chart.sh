#!/usr/bin/env bash
set -euo pipefail

# ─── CONFIG ──────────────────────────────────────────────────────────────────
REPO="${1:-w3f/helm-charts}"
BRANCH="${GITHUB_PAGES_BRANCH:-gh-pages}"
CHART_DIR="${HELM_CHARTS_SOURCE:-$PWD/deployment/chart}"

# ─── CLONE PAGES BRANCH ──────────────────────────────────────────────────────
PAGES="/tmp/helm-pages"
rm -rf "$PAGES"
git clone --branch="$BRANCH" --depth=1 "https://github.com/$REPO.git" "$PAGES"

# ─── SKIP IF THIS CHART VERSION IS ALREADY PUBLISHED ─────────────────────────
chart_name=$(awk '/^name:/ {print $2; exit}' "$CHART_DIR/Chart.yaml")
chart_version=$(awk '/^version:/ {print $2; exit}' "$CHART_DIR/Chart.yaml")
pkg="$PAGES/$chart_name/${chart_name}-${chart_version}.tgz"
if [[ -f "$pkg" ]]; then
  echo "ℹ️  Chart ${chart_name} version ${chart_version} already exists in ${BRANCH}; skipping publish."
  exit 0
fi

# ─── LINT ─────────────────────────────────────────────────────────────────────
helm lint "$CHART_DIR"

# ─── PACKAGE ──────────────────────────────────────────────────────────────────
mkdir -p "$PAGES/$chart_name"
helm package --destination "$PAGES/$chart_name" "$CHART_DIR"

# ─── REPO INDEX (merge existing) ──────────────────────────────────────────────
pushd "$PAGES" >/dev/null
helm repo index . \
  --url "https://${REPO%%/*}.github.io/${REPO#*/}/" \
  --merge index.yaml
popd >/dev/null

# ─── PUSH ────────────────────────────────────────────────────────────────────
pushd "$PAGES" >/dev/null
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git add .
if ! git diff --cached --quiet; then
  git commit -m "Published by GitHub Actions ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
else
  echo "No changes detected; skipping commit."
fi

git push "https://x-access-token:${HELM_CHARTS_TOKEN}@github.com/$REPO.git" "$BRANCH"
popd >/dev/null

echo "✅ Published $CHART_DIR to $REPO#$BRANCH"
