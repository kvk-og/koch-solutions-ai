#!/usr/bin/env bash
# =============================================================================
# KOCH AI - Full Stack Launcher (Apple Silicon Native Edition)
# =============================================================================
set -e

echo "=== KOCH AI Stack Launcher ==="

# 1. Environment initialization 
if [ ! -f .env ]; then
    echo "ERROR: Missing .env file. Please create one."
    exit 1
fi

echo "Creating mapped volume directories..."
mkdir -p ./data/models
mkdir -p ./data/hindsight
mkdir -p ./data/redis
mkdir -p ./data/shared-uploads

# 2. Check for Docker
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed."
    exit 1
fi

echo "[1/4] Starting Docker services (Frontend, Backend, Hindsight, Redis, Telegram)..."
# Ensure clean slate to avoid container artifacts
docker compose down --remove-orphans || true
docker compose up -d --build

echo "[2/4] Setting up native Python environment for Apple Silicon MPS..."
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "[3/4] Checking and installing native worker dependencies..."
pip install --upgrade pip > /dev/null
pip install python-dotenv docling torch torchvision torchaudio fastapi uvicorn httpx openai python-multipart

echo "[4/4] Starting Native Background Worker..."

# Check if port 9000 is already in use
if lsof -Pi :9000 -sTCP:LISTEN -t >/dev/null ; then
    echo "Port 9000 is in use. Killing existing native worker..."
    kill -9 $(lsof -Pi :9000 -sTCP:LISTEN -t)
fi

# Run logic
if [ "$1" == "--background" ]; then
    nohup python3 -m uvicorn workers.pipeline:app --host 0.0.0.0 --port 9000 > native-worker.log 2>&1 &
    echo "=== Stack Successfully Deployed ==="
    echo "Docker containers are running in the background."
    echo "Native worker is running in the background. Logs are in native-worker.log."
    echo "Access the application at http://localhost"
else
    # Trap SIGINT to safely bring down docker when the user stops the script
    cleanup() {
        echo ""
        echo "=== Stopping native worker and Docker stack ==="
        docker compose down
        exit 0
    }
    trap cleanup SIGINT SIGTERM

    echo "=== Stack Successfully Deployed ==="
    echo "Access the application at http://localhost"
    echo "Press Ctrl+C to gracefully stop everything (this terminal will stream the native worker logs)."
    python3 -m uvicorn workers.pipeline:app --host 0.0.0.0 --port 9000
fi
