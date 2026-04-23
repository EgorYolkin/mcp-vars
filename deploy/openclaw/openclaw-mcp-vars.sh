#!/bin/sh
set -eu

if [ -z "${PROJECT_ROOT:-}" ]; then
  if [ -n "${OPENCLAW_WORKSPACE:-}" ]; then
    PROJECT_ROOT="${OPENCLAW_WORKSPACE}"
  elif [ -n "${WORKSPACE_DIR:-}" ]; then
    PROJECT_ROOT="${WORKSPACE_DIR}"
  else
    PROJECT_ROOT="$PWD"
  fi
fi

: "${MCP_VARS_USER_DB_PATH:=/var/lib/mcp-vars/user/variables.json}"

export PROJECT_ROOT
export MCP_VARS_USER_DB_PATH

exec node /opt/mcp-vars/dist/cli.js "$@"
