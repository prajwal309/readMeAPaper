#!/usr/bin/env bash

# Start Sonora from the directory containing this script, so it works even
# when launched from another working directory.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting Sonora at http://127.0.0.1:4173"
python3 server.py
