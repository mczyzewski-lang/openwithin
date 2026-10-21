#!/bin/sh
# Container entrypoint: migrate + seed (both idempotent), then run the audio worker and the web app
# side by side. They share the /data volume, so they must live in the same service.
set -e

mkdir -p "${LOCAL_STORAGE_DIR:-/data/storage}"

npm run db:migrate
npm run db:seed

npm run worker &
WORKER_PID=$!

npx next start -p "${PORT:-3000}" &
WEB_PID=$!

# If either process exits, stop the other so the platform restarts the container.
trap 'kill $WORKER_PID $WEB_PID 2>/dev/null' TERM INT
while kill -0 $WORKER_PID 2>/dev/null && kill -0 $WEB_PID 2>/dev/null; do sleep 5; done
kill $WORKER_PID $WEB_PID 2>/dev/null || true
exit 1
