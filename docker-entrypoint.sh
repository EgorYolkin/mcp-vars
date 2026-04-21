#!/bin/sh
set -eu

if [ -n "${MCP_VARS_USER_DB_PATH:-}" ]; then
  mkdir -p "$(dirname "$MCP_VARS_USER_DB_PATH")"
fi

if [ -n "${MCP_VARS_PROJECT_DB_PATH:-}" ]; then
  mkdir -p "$(dirname "$MCP_VARS_PROJECT_DB_PATH")"
fi

if [ -n "${PROJECT_ROOT:-}" ]; then
  mkdir -p "$PROJECT_ROOT"
fi

exec "$@"
