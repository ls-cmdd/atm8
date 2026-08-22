#!/bin/bash
pkill -f tsx || true
sleep 2
nohup npx tsx src/index.ts > /tmp/server.log 2>&1 &
