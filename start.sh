#!/bin/bash
cd /home/Work/DeployCenter

echo "[Deploy Center] Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
  echo "[Deploy Center] Build failed!"
  exit 1
fi

echo "[Deploy Center] Starting server..."
exec node -r ./tsconfig-paths-bootstrap.js dist/index.js
