#!/usr/bin/env bash
# Plan morning-digest § 3/4. Runs rig, saves one page as one self-contained HTML file.
# Usage: scripts/save-preview.sh <out.html> [path]   (path defaults to /digest/2026-10-28)
# The banner shows LANE_MARKER from the environment, else from .env. LANE_MARKER= gives the clean copy.
set -euo pipefail
out="${1:?usage: save-preview.sh <out.html> [path]}"; path="${2:-/digest/2026-10-28}"
port="${PORT:-8799}"
# LANE_MARKER set in the environment (even empty) wins over .env, so the clean copy really is clean.
if [ -n "${LANE_MARKER+set}" ]; then envfile=(); else envfile=(--env-file-if-exists=.env); fi
curl -fs "http://localhost:$port/health" >/dev/null && { echo "ERROR: port $port already in use" >&2; exit 1; }
PORT="$port" setsid npx tsx "${envfile[@]}" src/server.ts >/dev/null 2>&1 & pid=$!
trap 'kill -- -$pid 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do curl -fs "http://localhost:$port/health" >/dev/null && break; sleep 0.2; done
mkdir -p "$(dirname "$out")"
curl -fsS "http://localhost:$port$path" -o "$out" || { echo "ERROR: GET $path failed" >&2; exit 1; }
grep -q '<table' "$out" || { echo "ERROR: $out has no table" >&2; exit 1; }
echo "saved $path -> $out ($(wc -c < "$out") bytes)"
