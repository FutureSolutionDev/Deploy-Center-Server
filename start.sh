#!/bin/bash
cd /home/Work/DeployCenter
# Git Pull
echo "[Deploy Center] Pulling latest changes..."
git pull

# Build
echo "[Deploy Center] Building TypeScript..."
npm run build
# Check if build was successful
if [ $? -ne 0 ]; then
  echo "[Deploy Center] Build failed!"
  exit 1
fi
# Restart PM2
echo "[Deploy Center] Restarting server..."
pm2 restart deploy-center