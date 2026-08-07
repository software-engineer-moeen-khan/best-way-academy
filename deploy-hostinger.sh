#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "Installing dependencies..."
npm ci

echo "Building Best Way Academy..."
npm run build

BUILD_DIR="$ROOT_DIR/dist/apps/web"
if [ ! -f "$BUILD_DIR/index.html" ]; then
  echo "Build failed: $BUILD_DIR/index.html not found" >&2
  exit 1
fi

echo "Publishing build to web root..."
rm -rf "$ROOT_DIR/assets"
cp -a "$BUILD_DIR/." "$ROOT_DIR/"

echo "Deployment complete. index.html and assets are ready in the current Hostinger web root."
