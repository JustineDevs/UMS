#!/usr/bin/env bash
set -euo pipefail

if ! command -v act >/dev/null 2>&1; then
  printf '%s\n' 'act is required. Install it from https://github.com/nektos/act' >&2
  exit 1
fi

act push -W .github/workflows/release-gate.yml
