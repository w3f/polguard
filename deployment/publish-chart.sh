#!/usr/bin/env bash
set -euo pipefail

# ─── CONFIG ──────────────────────────────────────────────────────────────────
REPO="${1:-w3f/helm-charts}"
BRANCH="${GITHUB_PAGES_BRANCH:-gh-pages}"
CHART_DIR="${HELM_CHARTS_SOURCE:-$PWD/deployment/chart}"

VERSION_TAG="${CIRCLE_TAG:-$(git describe --tags --exact-match 2>/dev/null || echo "")}"
if [[ -z "$VERSION_TAG" ]]; then
  echo "ERROR: must run on a Git tag (set \$CIRCLE_TAG)" >&2
  exit 1
fi

# ─── CLONE PAGES BRANCH ──────────────────────────────────────────────────────
PAGES="/tmp/helm-pages"
rm -rf "$PAGES"
git clone --branch="$BRANCH" --depth=1 "https://github.com/$REPO.git" "$PAGES"

# ─── SKIP IF ALREADY PUBLISHED ───────────────────────────────────────────────
chart_name=$(awk '/^name:/ {print $2; exit}' "$CHART_DIR/Chart.yaml")
pkg="$PAGES/$chart_name/${chart_name}-${VERSION_TAG}.tgz"
if [[ -f "$pkg" ]]; then
  echo "✅ Chart version $VERSION_TAG already published. Skipping."
  exit 0
fi

# ─── DEPENDENCIES & LINT ──────────────────────────────────────────────────────
helm dependency update "$CHART_DIR"
helm lint "$CHART_DIR"

# ─── PACKAGE ──────────────────────────────────────────────────────────────────
chart_name=$(awk '/^name:/ {print $2; exit}' "$CHART_DIR/Chart.yaml")
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
git config user.name "CircleCI"
git config user.email "$CIRCLE_USERNAME@users.noreply.github.com"

# Commit with original CI URL style
git add .
if ! git diff --cached --quiet; then
  git commit -m "Published by CircleCI $CIRCLE_BUILD_URL"
else
  echo "No changes detected; skipping commit."
fi

git push "https://${GITHUB_BOT_TOKEN}@github.com/$REPO.git" "$BRANCH"
popd >/dev/null

echo "✅ Published $CHART_DIR at tag $VERSION_TAG to $REPO#$BRANCH"
