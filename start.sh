#!/bin/bash

PORT="${1:-8080}"

echo "Starting BiztelAI OpsFlow on http://localhost:$PORT"
echo "Press Ctrl+C to stop."
echo ""

python3 -m http.server "$PORT"
