# KOCH AI — Engineering Intelligence Platform

> Air-gapped, on-premise AI platform for processing complex engineering documents (CAD, P&IDs, manuals), storing them in a temporal memory graph, and serving answers via a local LLM. All IP stays strictly on-premise.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend   │────▶│   Backend    │────▶│ External AI │
│  (Next.js)   │     │   (FastAPI)  │     │   (Ingham API)│
│  :3000       │     │   :8000      │     │             │
└─────────────┘     │              │     └─────────────┘
                    │              │────▶│  Hindsight  │
                    │              │     │  (Memory)   │
                    │              │     │  :8100      │
                    └──────────────┘     └─────────────┘
                           │
                    ┌──────────────┐
                    │   Workers    │
                    │ (Docling/VLM)│
                    │   :9000      │
                    └──────────────┘
```

## Quick Start

```bash
# 1. Clone and configure
cp .env.example .env
# Ensure your VLLM_API_KEY from Ingham AI is populated

# 2. Launch the full stack
docker compose up --build

# 3. Access the UI
open http://localhost:3000
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| **Frontend** | 3000 | Next.js Chat UI (App Router, Tailwind, TypeScript) |
| **Backend API** | 8000 | FastAPI orchestrator — routes queries and files |
| **Hindsight** | 8100 | Temporal memory graph (vector + entity storage) |
| **Workers** | 9000 | Document ingestion pipeline (Docling + VLM) |

## Key Endpoints

### Backend API
- `POST /api/chat` — Send a query, receive streamed AI response with context
- `POST /api/upload` — Upload engineering documents for ingestion
- `GET /api/conversations` — List conversation history
- `GET /health` — System health check
- `GET /docs` — Interactive API documentation (Swagger)

## Requirements

- Docker & Docker Compose v2
- Access to the `https://api.ingham.ai` endpoints with a valid token.

## Development

```bash
# Frontend only (hot reload)
cd frontend && npm install && npm run dev

# Backend only (hot reload)
cd backend && pip install -r requirements.txt && uvicorn main:app --reload

# Workers only (hot reload)
cd workers && pip install -r requirements.txt && uvicorn pipeline:app --port 9000 --reload
```

## License

Proprietary — Internal use only.
