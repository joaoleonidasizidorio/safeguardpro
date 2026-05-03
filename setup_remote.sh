#!/bin/bash
set -e

echo "Updating System..."
sudo apt-get update
sudo apt-get install -y docker.io docker-compose unzip

echo "Cleaning previous build..."
sudo groupadd docker || true
sudo usermod -aG docker $USER
echo "Setting up directories present..."
# Assumes files are already SCP'd to correct locations or will be moved
# We will SCP directly to safeguardpro/

# Ensure permissions
chmod +x safeguardpro/backend/scripts/*.js 2>/dev/null || true

# Move root files
mv docker-compose.prod.yml safeguardpro/docker-compose.yml
mv deploy-ready-backup.sql safeguardpro/
cp -r database/* safeguardpro/database/

cd safeguardpro

echo "Starting Docker/App..."
# Fix permissions if needed
chmod +x backend/dist/scripts/*.js 2>/dev/null || true

# Docker Compose Up
sudo docker-compose up -d --build

echo "Waiting for DB to initialize (30s)..."
sleep 50

echo "Restoring Backup..."
cat deploy-ready-backup.sql | sudo docker exec -i safeguardpro-db psql -U user -d safeguardpro

echo "Deployment Complete!"
echo "Access at http://$(curl -s ifconfig.me):80 (Frontend) or :6001 (Backend)"
