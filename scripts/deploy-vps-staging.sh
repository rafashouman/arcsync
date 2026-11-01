#!/usr/bin/env bash
set -Eeuo pipefail
umask 0027

ROOT=/opt/feedsync-staging
SHARED="$ROOT/shared"
RELEASES="$ROOT/releases"
SERVICE=feedsync-staging
PORT=3002

SHA="${1:-}"
if [[ ! "$SHA" =~ ^[a-f0-9]{40}$ ]]; then
  echo "Expected a full Git commit SHA." >&2
  exit 2
fi

RELEASE="$RELEASES/$SHA"
if [[ ! -d "$RELEASE" ]]; then
  echo "Release source directory is missing: $RELEASE" >&2
  exit 1
fi
if [[ ! -s "$SHARED/.env.production" ]]; then
  echo "Create $SHARED/.env.production before deploying." >&2
  exit 1
fi
if [[ ! -d "$SHARED/uploads" ]]; then
  echo "Create the persistent media directory: $SHARED/uploads" >&2
  exit 1
fi
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "Node.js 24.12+ and npm must be available to the deploy user." >&2
  exit 1
fi
if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 24 || (major === 24 && minor >= 12) ? 0 : 1)'; then
  echo "Node.js 24.12 or newer is required." >&2
  exit 1
fi
if ! sudo -n systemctl cat "$SERVICE" >/dev/null 2>&1; then
  echo "Install and enable the $SERVICE systemd unit before deploying." >&2
  exit 1
fi
if ! sudo -n -u feedsync-staging /usr/bin/test -w "$SHARED/uploads"; then
  echo "The feedsync-staging service user must be able to write to $SHARED/uploads." >&2
  exit 1
fi

ln -sfn "$SHARED/.env.production" "$RELEASE/.env.production"
cd "$RELEASE"
npm ci
NODE_ENV=production FEEDSYNC_UPLOADS_DIR="$SHARED/uploads" npm run check:env -- --production
npm run build

PREVIOUS_RELEASE=""
if [[ -L "$ROOT/current" ]]; then
  PREVIOUS_RELEASE="$(readlink "$ROOT/current")"
fi

activate_previous_release() {
  if [[ -n "$PREVIOUS_RELEASE" ]]; then
    ln -sfn "$PREVIOUS_RELEASE" "$ROOT/current.rollback"
    mv -Tf "$ROOT/current.rollback" "$ROOT/current"
    sudo -n systemctl restart "$SERVICE"
  else
    sudo -n systemctl stop "$SERVICE" || true
    rm -f "$ROOT/current"
  fi
}

ln -sfn "$RELEASE" "$ROOT/current.next"
mv -Tf "$ROOT/current.next" "$ROOT/current"

if ! sudo -n systemctl restart "$SERVICE"; then
  echo "Staging service failed to restart; restoring the previous release." >&2
  activate_previous_release
  exit 1
fi

if ! curl --fail --silent --show-error \
  --retry 12 --retry-connrefused --retry-delay 2 --max-time 5 \
  "http://127.0.0.1:$PORT/" >/dev/null; then
  echo "Staging health check failed; restoring the previous release." >&2
  activate_previous_release
  exit 1
fi

echo "Staging deployed successfully: $SHA"
