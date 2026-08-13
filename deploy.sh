#!/usr/bin/env bash
set -Eeuo pipefail

BRANCH="${DEPLOY_BRANCH:-awk-paid-courses-azadi-sale}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() {
  printf '\033[1;36m[BWA DEPLOY]\033[0m %s\n' "$*"
}

fail() {
  printf '\033[1;31m[BWA DEPLOY ERROR]\033[0m %s\n' "$*" >&2
  exit 1
}

cd "$ROOT"

command -v git >/dev/null 2>&1 || fail "Git is required on the server."
[[ -d .git ]] || fail "Run this command from the cloned Best Way Academy repository."
[[ -n "$(git remote get-url origin 2>/dev/null || true)" ]] || fail "Git remote 'origin' is missing."

# First pass: force the deployment checkout to the exact remote deployment branch,
# then re-exec the freshly downloaded copy of this script. Ignored server files such
# as .env, .deploy/, vendor/ and generated public_html/ are intentionally preserved.
if [[ "${BWA_DEPLOY_SYNCED:-0}" != "1" ]]; then
  log "Fetching latest origin/$BRANCH..."
  git fetch --prune origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"

  log "Switching deployment checkout to $BRANCH..."
  git checkout -f -B "$BRANCH" "origin/$BRANCH"
  git reset --hard "origin/$BRANCH"

  export BWA_DEPLOY_SYNCED=1
  exec bash "$ROOT/deploy.sh"
fi

[[ "$(git rev-parse --abbrev-ref HEAD)" == "$BRANCH" ]] || fail "Deployment branch verification failed."
[[ -f deploy/hostinger-deploy.sh ]] || fail "deploy/hostinger-deploy.sh is missing."

# Hostinger commonly has the repository itself checked out inside the domain's
# public_html directory. The existing Laravel publisher deliberately creates a
# generated public_html/ child directory; the repository-root .htaccess acts as
# the secure gateway to that generated web root.
export PUBLIC_HTML="${PUBLIC_HTML:-$ROOT/public_html}"
mkdir -p "$PUBLIC_HTML"

chmod +x deploy/hostinger-deploy.sh 2>/dev/null || true

log "Running Hostinger application deployment..."
bash deploy/hostinger-deploy.sh

SHORT_SHA="$(git rev-parse --short HEAD)"
log "Deployment completed successfully: $BRANCH @ $SHORT_SHA"
log "Future deployments: bash deploy.sh"
