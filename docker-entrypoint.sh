#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  npm run migration:run:dist
fi

exec "$@"
