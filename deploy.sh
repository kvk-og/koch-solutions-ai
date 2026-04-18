#!/usr/bin/env bash
# =============================================================================
# KOCH AI - Production Deployment Script
# =============================================================================
set -e

echo "=== KOCH AI Production Installer ==="
echo "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed. Please install Docker and try again."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "ERROR: Docker Compose is not installed (v2 required)."
    exit 1
fi

if ! command -v nvidia-smi &> /dev/null; then
    echo "WARNING: NVIDIA drivers not detected. If running vLLM, ensure your GPUs are accessible."
fi

# Environment initialization
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo "Creating .env from .env.example..."
        cp .env.example .env
        echo "Please edit the .env file to configure your secrets and model paths, then re-run this script."
        exit 0
    else
        echo "ERROR: Missing .env and .env.example files."
        exit 1
    fi
fi

echo "Creating mapped volume directories..."
mkdir -p ./data/models
mkdir -p ./data/hindsight
mkdir -p ./data/redis
mkdir -p ./data/shared-uploads

echo "Starting Docker stack in detached mode..."
docker compose up -d --build

echo "=== Deployment Successfully Initiated ==="
echo "Access the application at http://localhost (or via your configured proxy domain)"
echo "Check backend status: http://localhost/api/health (may take a moment to report healthy)"
