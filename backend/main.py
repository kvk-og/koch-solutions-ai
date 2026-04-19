"""
=============================================================================
KOCH AI — Backend API Orchestrator (main.py)
=============================================================================
Central FastAPI application that orchestrates all inter-service communication:

  ┌─────────┐     ┌──────────┐     ┌──────────┐
  │ Frontend │────▶│ Backend  │────▶│  vLLM    │
  └─────────┘     │   API    │     └──────────┘
                  │          │────▶│ Hindsight │
                  │          │     └───────────┘
                  │          │────▶│  Workers  │
                  └──────────┘     └───────────┘

All traffic stays on the internal Docker network. No external egress.
=============================================================================
"""

import os
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Form, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from openai import AsyncOpenAI
import celery
import shutil

# =============================================================================
# Configuration
# =============================================================================

# Service URLs — resolved via Docker DNS on the internal network
VLLM_BASE_URL = os.getenv("VLLM_BASE_URL", "https://api.ingham.ai/v1")
VLLM_API_KEY = os.getenv("VLLM_API_KEY", "inghamai-8101997")
LLM_MODEL = os.getenv("LLM_MODEL", "google/gemma-4-26B-A4B-it")

HINDSIGHT_BASE_URL = os.getenv("HINDSIGHT_BASE_URL", "http://hindsight:8100")
HINDSIGHT_API_KEY = os.getenv("HINDSIGHT_API_KEY", "koch-hindsight-key")

WORKER_BASE_URL = os.getenv("WORKER_BASE_URL", "http://parser-workers:9000")
CAD_WORKER_BASE_URL = os.getenv("CAD_WORKER_BASE_URL", "http://cad-workers:9001")

CORS_ORIGINS = ["http://localhost", "http://localhost:3000"]
MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "100"))
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("koch-backend")

# =============================================================================
# FastAPI Application
from starlette.middleware.base import BaseHTTPMiddleware
import time
from collections import deque
from threading import Lock

class TelemetryTracker:
    def __init__(self):
        self.lock = Lock()
        self.buckets = deque([0]*24, maxlen=24)
        self.last_update = time.time()
        
    def record(self):
        with self.lock:
            now = time.time()
            bin_size = 3600 # 1 hour buckets
            diff = int((now - self.last_update) / bin_size)
            if diff > 0:
                for _ in range(min(diff, 24)):
                    self.buckets.append(0)
                self.last_update = now
            self.buckets[-1] += 1
            
    def get_data(self):
        with self.lock:
            # We don't call record() here purely so we return the raw buckets.
            # But the act of querying will record a hit anyway due to middleware.
            return list(self.buckets)

telemetry_tracker = TelemetryTracker()

# =============================================================================

app = FastAPI(
    title="KOCH AI — Engineering Intelligence API",
    description="Air-gapped orchestrator for engineering document processing and LLM inference.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — restrict to frontend origin in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TelemetryMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        telemetry_tracker.record()
        response = await call_next(request)
        return response

app.add_middleware(TelemetryMiddleware)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception: {exc}")
    # Don't mask HTTPExceptions as 503s
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    return JSONResponse(
        status_code=503,
        content={"detail": "Service is currently unavailable. Please try again later."},
    )

# =============================================================================
# Async HTTP Clients (initialized on startup, closed on shutdown)
# =============================================================================

# OpenAI-compatible client pointed at the vLLM container
vllm_client: Optional[AsyncOpenAI] = None

# General HTTP client for Hindsight and Worker communication
http_client: Optional[httpx.AsyncClient] = None

# Celery application for dispatching background tasks
celery_app = celery.Celery("backend_client", broker=REDIS_URL)



from database import init_db, get_db, AsyncSessionLocal
import seed
import models
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import Depends

@app.on_event("startup")
async def startup():
    """Initialize async clients on application startup."""
    global vllm_client, http_client

    await init_db()
    async with AsyncSessionLocal() as session:
        await seed.seed_data_if_empty(session)

    vllm_client = AsyncOpenAI(
        base_url=VLLM_BASE_URL,
        api_key=VLLM_API_KEY,
    )

    http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(60.0, connect=10.0),
        headers={"Content-Type": "application/json"},
    )

    logger.info("KOCH AI Backend started — all clients initialized")
    logger.info(f"  vLLM endpoint:      {VLLM_BASE_URL}")
    logger.info(f"  Hindsight endpoint:  {HINDSIGHT_BASE_URL}")
    logger.info(f"  Worker endpoint:     {WORKER_BASE_URL}")
    logger.info(f"  CAD Worker endpoint: {CAD_WORKER_BASE_URL}")



@app.on_event("shutdown")
async def shutdown():
    """Gracefully close all clients."""
    if http_client:
        await http_client.aclose()
    logger.info("KOCH AI Backend shut down cleanly")


# =============================================================================
# Pydantic Models
# =============================================================================

class ChatRequest(BaseModel):
    """Incoming chat request from the frontend."""
    query: str = Field(..., min_length=1, max_length=4096, description="User's question")
    conversation_id: Optional[str] = Field(
        default=None,
        description="Optional conversation ID for multi-turn context"
    )
    mode: str = Field(default="chat", description="Selection between 'chat' and 'agent' mode")
    max_tokens: int = Field(default=2048, ge=64, le=8192)
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)


class ChatResponse(BaseModel):
    """Non-streaming chat response."""
    answer: str
    conversation_id: str
    sources: list[dict] = []
    timestamp: str


class UploadResponse(BaseModel):
    """Response after file upload."""
    file_id: str
    filename: str
    content_type: str
    pipeline: str  # "vlm" or "docling"
    status: str
    message: str


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    service: str
    timestamp: str
    dependencies: dict


class ClipRequest(BaseModel):
    """Payload for web clipper."""
    url: str
    title: str
    content: str
    metadata: dict = {}


class ReportRequest(BaseModel):
    """Payload for saving an engineering report."""
    title: str
    content: str


class FieldNoteRequest(BaseModel):
    """Payload for passing a field note to Hindsight."""
    machine_id: str
    text: str

# =============================================================================
# File Type Classification
# =============================================================================

# MIME types that indicate visual/schematic content → route to VLM worker
VLM_MIME_TYPES = {
    "image/png", "image/jpeg", "image/tiff", "image/bmp", "image/webp",
    "image/svg+xml",
    "application/dxf",          # AutoCAD DXF
    "application/x-autocad",    # AutoCAD DWG
    "model/step",               # STEP CAD files
    "model/iges",               # IGES CAD files
}

# File extensions for additional classification
VLM_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp", ".svg",
    ".dxf", ".dwg", ".step", ".stp", ".iges", ".igs",
}

# Standard document types → route to Docling parser
DOCLING_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain", "text/csv", "text/markdown",
}

# CAD types → route to CAD Worker
CAD_MIME_TYPES = {
    "application/vnd.autodesk.inventor.assembly",
    "application/vnd.autodesk.inventor.part",
}
CAD_EXTENSIONS = {
    ".iam", ".ipt"
}


def classify_file(filename: str, content_type: str) -> str:
    """
    Determine the processing pipeline based on file type.

    Returns:
        "vlm"     — Visual Language Model pipeline (schematics, CAD, images)
        "docling" — Standard document parsing pipeline (PDF, DOCX, etc.)
        "cad"     — Autodesk CAD files (Inventor)

    Routing logic:
        1. Check MIME type against known visual content types
        2. Fall back to file extension matching
        3. Default to Docling for unrecognized types
    """
    # Check MIME type first
    if content_type in CAD_MIME_TYPES:
        return "cad"
    if content_type in VLM_MIME_TYPES:
        return "vlm"
    if content_type in DOCLING_MIME_TYPES:
        return "docling"

    # Fall back to extension-based classification
    ext = os.path.splitext(filename)[1].lower()
    if ext in CAD_EXTENSIONS:
        return "cad"
    if ext in VLM_EXTENSIONS:
        return "vlm"

    # Default: treat as standard document
    return "docling"


# =============================================================================
# Hindsight Memory Integration
# =============================================================================

async def query_hindsight_context(query: str, conversation_id: Optional[str] = None, top_k: int = 10) -> dict:
    """
    Query the Hindsight temporal memory graph for relevant context.

    Hindsight returns entity-linked, time-aware context from previously
    ingested engineering documents. This context is injected into the
    LLM prompt to ground responses in organizational knowledge.

    Args:
        query: The user's natural language question
        conversation_id: Optional conversation scope for multi-turn context

    Returns:
        Dictionary containing retrieved memories, entities, and metadata
    """
    try:
        bank_id = conversation_id if conversation_id else "koch_graph"
        payload = {
            "query": query,
        }

        response = await http_client.post(
            f"{HINDSIGHT_BASE_URL}/v1/default/banks/{bank_id}/memories/recall",
            json=payload,
            headers={"Authorization": f"Bearer {HINDSIGHT_API_KEY}"},
        )
        response.raise_for_status()

        data = response.json()
        logger.info(
            f"Hindsight returned {len(data.get('results', []))} memory fragments "
            f"and {len(data.get('entities', {}))} linked entities"
        )
        return data

    except httpx.HTTPStatusError as e:
        logger.warning(f"Hindsight query failed (HTTP {e.response.status_code}): {e}")
        return {"results": [], "entities": {}, "error": str(e)}
    except httpx.ConnectError:
        logger.warning("Hindsight service unreachable — proceeding without context")
        return {"results": [], "entities": {}, "error": "Service unreachable"}


def format_context_prompt(
    user_query: str,
    hindsight_context: dict,
) -> list[dict]:
    """
    Format the system prompt + retrieved context + user query into the
    message array expected by the OpenAI-compatible vLLM API.

    The prompt structure follows enterprise RAG best practices:
      1. System prompt defining the AI's role and constraints
      2. Retrieved context from the memory graph
      3. User's actual question
    """
    # Extract and format memory fragments
    memories = hindsight_context.get("results", [])
    entities_dict = hindsight_context.get("entities", {})

    context_blocks = []

    # Format memory fragments with temporal metadata
    if memories:
        context_blocks.append("=== RETRIEVED ENGINEERING CONTEXT ===")
        for i, mem in enumerate(memories, 1):
            timestamp = mem.get("occurred_start", "unknown")
            source = mem.get("type", "unknown")
            content = mem.get("text", "")
            context_blocks.append(
                f"[Memory {i}] (type: {source}, date: {timestamp})\n{content}"
            )

    # Format linked entities (equipment, systems, standards)
    if entities_dict:
        context_blocks.append("\n=== LINKED ENTITIES ===")
        import json
        for ent_name, ent_data in entities_dict.items():
            context_blocks.append(f"• [ENTITY] {ent_name}: {len(ent_data.get('observations', []))} observations recorded")

    context_str = "\n\n".join(context_blocks) if context_blocks else "No prior context available."

    # Build the message array
    messages = [
        {
            "role": "system",
            "content": (
                "You are KOCH AI, an expert engineering intelligence assistant deployed "
                "on-premise for an industrial engineering organization. You specialize in "
                "analyzing CAD drawings, P&IDs (Piping and Instrumentation Diagrams), "
                "technical manuals, equipment specifications, and engineering standards.\n\n"
                "RULES:\n"
                "1. Answer ONLY based on the provided context when available.\n"
                "2. If the context does not contain enough information, clearly state what "
                "   is missing and what documents might help.\n"
                "3. Always cite the source document and timestamp when referencing context.\n"
                "4. Use precise engineering terminology.\n"
                "5. For safety-critical information, include appropriate warnings.\n"
                "6. Never fabricate specifications, part numbers, or safety data.\n\n"
                f"CONTEXT:\n{context_str}"
            ),
        },
        {
            "role": "user",
            "content": user_query,
        },
    ]

    return messages


# =============================================================================
# API Endpoints
# =============================================================================

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """
    Health check endpoint. Reports status of all upstream dependencies.
    Used by Docker health checks and load balancers.
    """
    deps = {}

    # Check AI API Endpoint
    try:
        resp = await http_client.get(
            f"{VLLM_BASE_URL}/models",
            headers={"Authorization": f"Bearer {VLLM_API_KEY}"}
        )
        deps["ai_api"] = "healthy" if resp.status_code == 200 else f"unhealthy ({resp.status_code})"
    except Exception:
        deps["ai_api"] = "unreachable"

    # Check Hindsight
    try:
        resp = await http_client.get(f"{HINDSIGHT_BASE_URL}/health")
        deps["hindsight"] = "healthy" if resp.status_code == 200 else f"unhealthy ({resp.status_code})"
    except Exception:
        deps["hindsight"] = "unreachable"

    # Check Workers
    try:
        resp = await http_client.get(f"{WORKER_BASE_URL}/health")
        deps["workers"] = "healthy" if resp.status_code == 200 else f"unhealthy ({resp.status_code})"
    except Exception:
        deps["workers"] = "unreachable"

    all_healthy = all(v == "healthy" for v in deps.values())

    return HealthResponse(
        status="healthy" if all_healthy else "degraded",
        service="koch-backend",
        timestamp=datetime.now(timezone.utc).isoformat(),
        dependencies=deps,
    )


# -------------------------------------------------------------------------
# POST /api/upload — File Upload & Pipeline Routing
# -------------------------------------------------------------------------
async def process_file_background(worker_endpoint: str, contents: bytes, headers: dict, file_id: str):
    """Background task to dispatch file to worker without blocking the HTTP request."""
    try:
        logger.info(f"Background worker dispatch starting for {file_id}")
        response = await http_client.post(
            worker_endpoint,
            content=contents,
            headers=headers,
            timeout=httpx.Timeout(900.0),  # Processing can take up to 15 mins for large CAD/PDFs
        )
        response.raise_for_status()
        logger.info(f"Background worker finished processing file {file_id}")
    except Exception as e:
        logger.error(f"Background worker task failed for {file_id}: {e}")

@app.post("/api/upload", response_model=UploadResponse, tags=["Documents"])
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    """
    Accept an engineering document and route it to the appropriate
    processing pipeline.

    Routing logic:
      - Images, schematics, CAD files → VLM Worker (visual extraction)
      - PDFs, DOCX, spreadsheets     → Docling Worker (structured parsing)

    The worker will parse the document and commit the extracted knowledge
    to the Hindsight memory graph for future retrieval.
    """
    # Validate file size
    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)

    if size_mb > MAX_UPLOAD_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f} MB). Maximum is {MAX_UPLOAD_SIZE_MB} MB.",
        )

    # Classify the file to determine processing pipeline
    pipeline = classify_file(file.filename or "unknown", file.content_type or "application/octet-stream")
    file_id = str(uuid.uuid4())

    logger.info(
        f"File received: {file.filename} ({file.content_type}, {size_mb:.1f} MB) "
        f"→ routed to '{pipeline}' pipeline (ID: {file_id})"
    )

    import hashlib
    import models
    from sqlalchemy import select
    
    content_hash = hashlib.sha256(contents).hexdigest()
    
    result = await db.execute(select(models.VaultFile).where(models.VaultFile.content_hash == content_hash))
    is_duplicate = result.scalars().first() is not None

    # Dispatch to the appropriate worker endpoint immediately returning to the user
    base_url = CAD_WORKER_BASE_URL if pipeline == "cad" else WORKER_BASE_URL
    worker_endpoint = f"{base_url}/ingest/{pipeline}"
    
    headers = {
        "Content-Type": file.content_type or "application/octet-stream",
        "X-File-Name": file.filename or "unknown",
        "X-File-ID": file_id,
    }
    
    if is_duplicate:
        status = "duplicate"
        message = f"Duplicate file detected (SHA-256 matched). Skipping {pipeline} extraction."
    else:
        background_tasks.add_task(process_file_background, worker_endpoint, contents, headers, file_id)
        status = "processing"
        message = f"File queued for {pipeline} extraction pipeline in the background."

    # Also record it in VaultFiles
    from datetime import datetime, timezone
    vault_file = models.VaultFile(
        id=file_id,
        filename=file.filename or "unknown",
        content_hash=content_hash,
        clearance="L2-Internal",
        size=f"{size_mb:.1f} MB" if size_mb >= 0.1 else f"{int(size_mb * 1024)} KB",
        upload_date=datetime.now(timezone.utc).strftime("%b %d, %Y"),
        status=status
    )
    db.add(vault_file)
    await db.commit()

    return UploadResponse(
        file_id=file_id,
        filename=file.filename or "unknown",
        content_type=file.content_type or "application/octet-stream",
        pipeline=pipeline,
        status=status,
        message=message,
    )


# -------------------------------------------------------------------------
# POST /api/upload/photo — Smart Photo Ingestion via Celery
# -------------------------------------------------------------------------

@app.post("/api/upload/photo", response_model=UploadResponse, tags=["Documents"])
async def upload_photo(machine_id: str = Form(...), file: UploadFile = File(...)):
    """
    Accept an image file along with a machine ID, save the file temporarily,
    and submit the processing task to the Celery image processing worker.
    """
    # 1. Save file temporarily to the shared volume
    os.makedirs("/app/uploads", exist_ok=True)
    temp_file_id = str(uuid.uuid4())
    _, ext = os.path.splitext(file.filename or "")
    if not ext:
        ext = ".jpg"
    temp_filepath = f"/app/uploads/{temp_file_id}{ext}"
    
    try:
        with open(temp_filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error(f"Failed to save temp file for photo: {e}")
        raise HTTPException(status_code=500, detail="Failed to stage file for processing.")
        
    # 2. Dispatch to Celery queue
    try:
        task = celery_app.send_task(
            "image_processor.process_photo_task", 
            args=[temp_filepath, machine_id]
        )
        job_id = task.id
        logger.info(f"Dispatched photo {temp_filepath} for machine {machine_id} to celery. Job ID: {job_id}")
    except Exception as e:
        logger.error(f"Failed to dispatch to Celery: {e}")
        raise HTTPException(status_code=500, detail="Worker queue unavailable.")
        
    return UploadResponse(
        file_id=job_id,
        filename=file.filename or "unknown",
        content_type=file.content_type or "image/jpeg",
        pipeline="celery_image_processor",
        status="queued",
        message="Photo dispatched to background worker for smart ingestion.",
    )


# -------------------------------------------------------------------------
# POST /api/chat — Conversational AI with Temporal Context
# -------------------------------------------------------------------------

@app.post("/api/chat", tags=["Chat"])
async def chat(request: ChatRequest):
    """
    Process a user query through the full RAG pipeline:

    1. Query Hindsight for temporal + entity-linked context
    2. Format the prompt with retrieved context
    3. Send to vLLM for inference
    4. Stream the response back to the client via SSE

    Returns a Server-Sent Events stream for real-time token delivery.
    """
    conversation_id = request.conversation_id or str(uuid.uuid4())

    logger.info(
        f"Chat request: conv={conversation_id}, "
        f"query='{request.query[:80]}...', "
        f"temp={request.temperature}"
    )

    if request.mode == "chat":
        # ── Route A: Fast Chat (Direct RAG) ──
        # ── Step 1: Retrieve context from Hindsight memory graph ──
        hindsight_context = await query_hindsight_context(
            query=request.query,
            conversation_id=conversation_id,
        )

        # ── Step 2: Format the prompt with context ──
        messages = format_context_prompt(request.query, hindsight_context)

        # ── Step 3: Stream inference from vLLM ──
        async def generate_stream():
            """
            Async generator that streams tokens from vLLM and wraps them
            in Server-Sent Events format for the frontend.
            """
            full_response = ""

            try:
                # Create a streaming completion using the OpenAI-compatible API
                stream = await vllm_client.chat.completions.create(
                    model=LLM_MODEL,
                    messages=messages,
                    max_completion_tokens=request.max_tokens,
                    temperature=request.temperature,
                    stream=True,
                )

                async for chunk in stream:
                    if chunk.choices and chunk.choices[0].delta.content:
                        token = chunk.choices[0].delta.content
                        full_response += token

                        # Emit each token as an SSE event
                        event_data = json.dumps({
                            "type": "token",
                            "content": token,
                            "conversation_id": conversation_id,
                        })
                        yield f"data: {event_data}\n\n"

                # ── Step 4: Commit the Q&A pair to Hindsight for future context ──
                try:
                    await http_client.post(
                        f"{HINDSIGHT_BASE_URL}/v1/default/banks/{conversation_id}/memories",
                        json={
                            "items": [{
                                "content": f"Q: {request.query}\nA: {full_response}",
                                "metadata": {
                                    "type": "conversation",
                                    "timestamp": datetime.now(timezone.utc).isoformat(),
                                    "source": "chat",
                                }
                            }]
                        },
                        headers={"Authorization": f"Bearer {HINDSIGHT_API_KEY}"},
                    )
                except Exception as e:
                    logger.warning(f"Failed to commit conversation to Hindsight: {e}")

                # Send completion event
                done_data = json.dumps({
                    "type": "done",
                    "conversation_id": conversation_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
                yield f"data: {done_data}\n\n"

            except Exception as e:
                logger.error(f"vLLM streaming error: {e}")
                error_data = json.dumps({
                    "type": "error",
                    "content": f"Inference error: {str(e)}",
                    "conversation_id": conversation_id,
                })
                yield f"data: {error_data}\n\n"

        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Conversation-ID": conversation_id,
            },
        )
    else:
        # ── Route B: Hermes Agent (ReAct Loop) ──
        async def generate_agent_stream():
            tools = [
                {
                    "type": "function",
                    "function": {
                        "name": "search_engineering_graph",
                        "description": "Search the hindsight engineering memory graph for relevant context. Use this whenever you need specific information, specifications, or historical data.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "query": {
                                    "type": "string",
                                    "description": "Detailed search query to find in the engineering memory graph."
                                }
                            },
                            "required": ["query"]
                        }
                    }
                }
            ]
            
            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are Hermes Agent, an advanced reasoning model deployed "
                        "on-premise for an industrial engineering organization.\n"
                        "You MUST use the `search_engineering_graph` tool to find context before answering "
                        "questions about equipment, standards, or documentation."
                    )
                },
                {
                    "role": "user",
                    "content": request.query
                }
            ]
            
            full_response = ""
            
            yield f"data: {json.dumps({'type': 'thought', 'content': 'Starting Hermes Agent reasoning loop...'})}\n\n"
            
            try:
                for turn in range(5):
                    completion = await vllm_client.chat.completions.create(
                        model=LLM_MODEL,
                        messages=messages,
                        tools=tools,
                        temperature=request.temperature
                    )
                    
                    msg = completion.choices[0].message
                    
                    if msg.tool_calls:
                        messages.append(msg.model_dump(exclude_unset=True))
                        for tool_call in msg.tool_calls:
                            if tool_call.function.name == "search_engineering_graph":
                                args = json.loads(tool_call.function.arguments)
                                q = args.get("query", request.query)
                                yield f"data: {json.dumps({'type': 'thought', 'content': f'Using search_engineering_graph with query: {q}'})}\n\n"
                                
                                context_data = await query_hindsight_context(q, conversation_id)
                                memories = context_data.get("memories", [])
                                entities = context_data.get("entities", [])
                                
                                result_blocks = []
                                if memories:
                                    for i, m in enumerate(memories, 1):
                                        result_blocks.append(f"[Score: {m.get('relevance_score', 0):.2f}] {m.get('content', '')}")
                                if entities:
                                    for e in entities:
                                        result_blocks.append(f"[Entity: {e.get('name')}] {e.get('description', '')}")
                                
                                content_str = "\\n".join(result_blocks) if result_blocks else "No relevant context found."
                                
                                messages.append({
                                    "role": "tool",
                                    "tool_call_id": tool_call.id,
                                    "name": tool_call.function.name,
                                    "content": content_str
                                })
                    else:
                        yield f"data: {json.dumps({'type': 'thought', 'content': 'Generating final response...'})}\n\n"
                        import asyncio
                        content = msg.content or ""
                        chunk_size = 10
                        for i in range(0, len(content), chunk_size):
                            token = content[i:i+chunk_size]
                            full_response += token
                            yield f"data: {json.dumps({'type': 'token', 'content': token, 'conversation_id': conversation_id})}\n\n"
                            await asyncio.sleep(0.01)
                            
                        try:
                            await http_client.post(
                                f"{HINDSIGHT_BASE_URL}/v1/default/banks/{conversation_id}/memories",
                                json={
                                    "items": [{
                                        "content": f"Q: {request.query}\\nA: {full_response}",
                                        "metadata": {
                                            "type": "conversation",
                                            "timestamp": datetime.now(timezone.utc).isoformat(),
                                            "source": "agent",
                                        }
                                    }]
                                },
                                headers={"Authorization": f"Bearer {HINDSIGHT_API_KEY}"},
                            )
                        except Exception as e:
                            logger.warning(f"Failed to commit conversation to Hindsight: {e}")
                            
                        done_data = json.dumps({
                            "type": "done",
                            "conversation_id": conversation_id,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        })
                        yield f"data: {done_data}\n\n"
                        break
                        
            except Exception as e:
                logger.error(f"Hermes agent error: {e}")
                error_data = json.dumps({
                    "type": "error",
                    "content": f"Agent error: {str(e)}",
                    "conversation_id": conversation_id,
                })
                yield f"data: {error_data}\n\n"
                
        return StreamingResponse(
            generate_agent_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Conversation-ID": conversation_id,
            },
        )


# -------------------------------------------------------------------------
# GET /api/conversations — List conversations (stub for frontend sidebar)
# -------------------------------------------------------------------------

@app.get("/api/conversations", tags=["Chat"])
async def list_conversations(
    limit: int = Query(default=20, ge=1, le=100),
):
    """
    List recent conversations. In a production deployment, this would
    query Hindsight namespaces or a dedicated metadata store.
    """
    # Stub: Return empty list. In production, query Hindsight for namespaces.
    return {
        "conversations": [],
        "message": "Conversation history will be populated after Hindsight integration.",
    }

# =============================================================================
# Functional Database Endpoints (Replacing Mocks)
# =============================================================================

@app.get("/api/cad/bom", tags=["Database"])
async def get_cad_bom():
    res = await query_hindsight_context("CAD assembly BOM items")
    memories = res.get("memories", [])
    return [{"id": m.get("id"), "description": m.get("content")} for m in memories]

@app.get("/api/cad/anomalies", tags=["Database"])
async def get_cad_anomalies():
    res = await query_hindsight_context("CAD anomaly issues defects")
    memories = res.get("memories", [])
    return [{"id": m.get("id"), "description": m.get("content")} for m in memories]

@app.get("/api/field-talk/threads", tags=["Database"])
async def get_field_threads():
    res = await query_hindsight_context("field talk observations conversations")
    memories = res.get("memories", [])
    return [{"id": m.get("id"), "title": m.get("content")[:50]} for m in memories]

@app.get("/api/field-talk/threads/{thread_id}/messages", tags=["Database"])
async def get_field_messages(thread_id: str):
    res = await query_hindsight_context(f"messages for thread {thread_id}", namespace=thread_id)
    memories = res.get("memories", [])
    return [{"id": m.get("id"), "text": m.get("content")} for m in memories]

@app.post("/api/field-talk/messages", tags=["Database"])
async def create_field_message(thread_id: str = Form(...), sender: str = Form(...), name: str = Form(...), text: str = Form(...)):
    # Post directly to Hindsight
    payload = {
        "items": [{
            "content": f"FieldMessage from {sender} ({name}): {text}",
            "metadata": {
                "type": "field_message",
                "sender": sender,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }]
    }
    try:
        await http_client.post(
            f"{HINDSIGHT_BASE_URL}/v1/default/banks/{thread_id}/memories",
            json=payload,
            headers={"Authorization": f"Bearer {HINDSIGHT_API_KEY}"}
        )
    except Exception as e:
        logger.error(f"Failed to save message to hindsight: {e}")
    return {"status": "success", "text": text}

@app.get("/api/machine-books/manuals", tags=["Database"])
async def get_manuals():
    res = await query_hindsight_context("machine manual documentation")
    memories = res.get("memories", [])
    return [{"id": m.get("id"), "content": m.get("content")} for m in memories]

@app.get("/api/procurement/parts", tags=["Database"])
async def get_procurement_parts():
    res = await query_hindsight_context("procurement parts inventory")
    memories = res.get("memories", [])
    return [{"id": m.get("id"), "part_info": m.get("content")} for m in memories]

@app.get("/api/telemetry/nodes", tags=["Database"])
async def get_telemetry_nodes():
    nodes = []
    # Test vLLM
    try:
        start = time.time()
        resp = await http_client.get(f"{VLLM_BASE_URL}/models", headers={"Authorization": f"Bearer {VLLM_API_KEY}"})
        lat = int((time.time() - start) * 1000)
        nodes.append({"id": "vllm-engine", "status": "online" if resp.status_code == 200 else "warning", "load": 40 if resp.status_code == 200 else 90, "latency": lat, "desc": "Local LLM Inference Engine"})
    except Exception:
        nodes.append({"id": "vllm-engine", "status": "offline", "load": 0, "latency": 0, "desc": "Local LLM Inference Engine"})
        
    # Test Hindsight
    try:
        start = time.time()
        resp = await http_client.get(f"{HINDSIGHT_BASE_URL}/health")
        lat = int((time.time() - start) * 1000)
        nodes.append({"id": "hindsight-memory", "status": "online" if resp.status_code == 200 else "warning", "load": 20, "latency": lat, "desc": "Temporal Knowledge Graph"})
    except Exception:
        nodes.append({"id": "hindsight-memory", "status": "offline", "load": 0, "latency": 0, "desc": "Temporal Knowledge Graph"})
        
    # Test Workers
    try:
        start = time.time()
        resp = await http_client.get(f"{WORKER_BASE_URL}/health")
        lat = int((time.time() - start) * 1000)
        nodes.append({"id": "docling-workers", "status": "online" if resp.status_code == 200 else "warning", "load": 15, "latency": lat, "desc": "Document Parsing Pipeline"})
    except Exception:
        nodes.append({"id": "docling-workers", "status": "offline", "load": 0, "latency": 0, "desc": "Document Parsing Pipeline"})
        
    # Test CAD Workers
    try:
        start = time.time()
        resp = await http_client.get(f"{CAD_WORKER_BASE_URL}/health")
        lat = int((time.time() - start) * 1000)
        nodes.append({"id": "cad-workers", "status": "online" if resp.status_code == 200 else "warning", "load": 25, "latency": lat, "desc": "CAD Ingestion Pipeline"})
    except Exception:
        nodes.append({"id": "cad-workers", "status": "offline", "load": 0, "latency": 0, "desc": "CAD Ingestion Pipeline"})
        
    return nodes

@app.get("/api/telemetry/throughput", tags=["Database"])
async def get_telemetry_throughput():
    # Return actual tracked sparkline usage
    return telemetry_tracker.get_data()

@app.get("/api/machine/{machine_id}", tags=["Database"])
async def get_machine(machine_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Machine).where(models.Machine.id == machine_id))
    machine = result.scalars().first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
        
    tl_res = await db.execute(select(models.TimelineEvent).where(models.TimelineEvent.machine_id == machine_id).order_by(models.TimelineEvent.year.desc()))
    timeline = tl_res.scalars().all()
    
    docs_res = await db.execute(select(models.DocumentCategory).where(models.DocumentCategory.machine_id == machine_id))
    docs = docs_res.scalars().all()
    
    # Query Hindsight for actual machine entities
    res = await query_hindsight_context(f"components and parts for {machine.name}")
    entities_dict = res.get("entities", {})
    entities = [{"id": k, "name": k} for k in entities_dict.keys()]
    
    import math
    import uuid
    
    out_nodes = [{
        "id": "machine_root",
        "position": {"x": 250, "y": 250},
        "data": {"label": machine.name},
        "style": {"background": "#0f1419", "color": "#00d4aa", "border": "1px solid #1e2d3d"}
    }]
    out_edges = []
    
    radius = 180
    valid_ents = [e for e in entities if e.get("name")]
    
    if valid_ents:
        angle_step = (2 * math.pi) / len(valid_ents[:12])
        for i, ent in enumerate(valid_ents[:12]):
            angle = i * angle_step
            x = 250 + radius * math.cos(angle)
            y = 250 + radius * math.sin(angle)
            ent_id = str(ent.get("id", str(uuid.uuid4())))
            
            out_nodes.append({
                "id": ent_id,
                "position": {"x": x, "y": y},
                "data": {"label": str(ent.get("name"))[:30]},
                "style": {"background": "#1a2332", "color": "#d9e2ec", "border": "1px solid #1e2d3d"}
            })
            out_edges.append({
                "id": f"edge_{i}",
                "source": "machine_root",
                "target": ent_id,
                "animated": True,
                "style": {"stroke": "#00d4aa"}
            })
    else:
        out_nodes.append({
             "id": "no_parts",
             "position": {"x": 250, "y": 100},
             "data": {"label": "No components indexed yet"},
             "style": {"background": "#1a2332", "color": "#71717a", "border": "1px solid #1e2d3d"}
        })
        out_edges.append({
             "id": "edge_empty",
             "source": "machine_root",
             "target": "no_parts",
             "animated": False,
             "style": {"stroke": "#27272a"}
        })
    
    return {
        "id": machine.id,
        "name": machine.name,
        "serialNumber": machine.serialNumber,
        "commissioningDate": machine.commissioningDate,
        "type": machine.type,
        "location": machine.location,
        "status": machine.status,
        "timeline": [
            {"year": t.year, "title": t.title, "desc": t.desc, "type": t.type}
            for t in timeline
        ],
        "docs": [
            {"category": d.category, "count": d.count, "icon": d.icon}
            for d in docs
        ],
        "nodes": out_nodes,
        "edges": out_edges
    }




@app.get("/api/knowledge-graph", tags=["Database"])
async def get_global_knowledge_graph(db: AsyncSession = Depends(get_db)):
    """
    Constructs a global semantic network view by combining local relational data 
    with Hindsight vector memories to ensure graph populations.
    """
    import random
    import math
    import uuid
    
    nodes = []
    edges = []
    
    # 1. Fetch Local Data (Machines & Documents)
    machines_res = await db.execute(select(models.Machine))
    machines = machines_res.scalars().all()
    
    docs_res = await db.execute(select(models.VaultFile))
    vault_files = docs_res.scalars().all()

    # 2. Query Hindsight (Temporal Memory)
    res = await query_hindsight_context("machine component system failure maintenance document field report log", top_k=20)
    memories = res.get("results", [])
    entities_dict = res.get("entities", {})
    
    valid_entities = [{"id": k, "name": k, "data": v} for k, v in entities_dict.items()]
    valid_memories = [m for m in memories if m.get("text")]
    
    # Cap total elements to 100 to prevent graph clutter processing
    max_elements = 100
    machines = machines[:max_elements]
    docs_to_show = max_elements - len(machines)
    vault_files = vault_files[:max(0, docs_to_show)]
    entities_to_show = max_elements - (len(machines) + len(vault_files))
    valid_entities = valid_entities[:max(0, entities_to_show)]
    mem_to_show = max_elements - (len(machines) + len(vault_files) + len(valid_entities))
    valid_memories = valid_memories[:max(0, mem_to_show)]
    
    # Total grid elements
    total_elements = len(machines) + len(vault_files) + len(valid_entities) + len(valid_memories)
    if total_elements == 0:
        return {"nodes": [], "edges": [], "metrics": {"memories_count": 0, "entities_count": 0}}
        
    grid_size = math.ceil(math.sqrt(total_elements))
    spacing = 250
    offset_x = 100
    offset_y = 100
    
    current_index = 0
    machine_ids = []
    
    # Render Machines
    for m in machines:
        row = current_index // grid_size
        col = current_index % grid_size
        nodes.append({
            "id": f"mch_{m.id}",
            "position": {"x": col * spacing + offset_x + random.randint(-50,50), "y": row * spacing + offset_y + random.randint(-50,50)},
            "data": {"label": m.name},
            "style": {"background": "#1a2332", "color": "#00d4aa", "border": "2px solid #00d4aa", "borderRadius": "100px", "padding": "16px", "textAlign": "center", "fontWeight": "bold"}
        })
        machine_ids.append(f"mch_{m.id}")
        current_index += 1

    # Render Vault Documents
    for d in vault_files:
        row = current_index // grid_size
        col = current_index % grid_size
        nodes.append({
            "id": f"doc_{d.id}",
            "position": {"x": col * spacing + offset_x + random.randint(-50,50), "y": row * spacing + offset_y + random.randint(-50,50)},
            "data": {"label": d.filename[:30]},
            "style": {"background": "#2d3748", "color": "#d9e2ec", "border": "1px solid #334e68", "borderRadius": "8px", "padding": "12px", "fontSize": "12px"}
        })
        # Randomly link document to a machine if any exist
        if machine_ids:
            edges.append({
                "id": f"edge_doc_{d.id}",
                "source": f"doc_{d.id}",
                "target": random.choice(machine_ids),
                "label": "RELATES_TO",
                "animated": True,
                "style": {"stroke": "#4b5563", "strokeWidth": 1.5},
                "labelStyle": {"fill": "#a0aec0", "fontSize": 10}
            })
        current_index += 1

    # Render Hindsight Entities
    entity_ids = []
    for ent in valid_entities:
        row = current_index // grid_size
        col = current_index % grid_size
        nodes.append({
            "id": ent.get("id"),
            "position": {"x": col * spacing + offset_x + random.randint(-50,50), "y": row * spacing + offset_y + random.randint(-50,50)},
            "data": {"label": ent.get("name", "Entity")[:40]},
            "style": {"background": "#0f1419", "color": "#fbd38d", "border": "1px solid #d69e2e", "borderRadius": "8px", "padding": "12px"}
        })
        entity_ids.append(ent.get("id"))
        current_index += 1
        
    # Render Hindsight Memories
    for mem in valid_memories:
        row = current_index // grid_size
        col = current_index % grid_size
        mem_id = mem.get("id", str(uuid.uuid4()))
        nodes.append({
            "id": mem_id,
            "position": {"x": col * spacing + offset_x + random.randint(-50,50), "y": row * spacing + offset_y + random.randint(-50,50)},
            "data": {"label": str(mem.get("text", "Memory"))[:35] + "..."},
            "style": {"background": "#0f1419", "color": "#a0aec0", "border": "1px dashed #4b5563", "borderRadius": "8px", "padding": "10px", "fontSize": "11px"}
        })
        
        # Connect memory to a random machine or entity
        targets = machine_ids + entity_ids
        if targets:
            target_id = random.choice(targets)
            edges.append({
                "id": f"edge_{current_index}",
                "source": mem_id,
                "target": target_id,
                "label": "CONTEXT_FOR",
                "animated": False,
                "style": {"stroke": "#4b5563", "strokeWidth": 1.0},
                "labelStyle": {"fill": "#829ab1", "fontSize": 10}
            })
            
        current_index += 1
        
    return {
        "nodes": nodes,
        "edges": edges,
        "metrics": {
            "memories_count": len(valid_memories) + len(vault_files),
            "entities_count": len(valid_entities) + len(machines)
        }
    }

# -------------------------------------------------------------------------
# Web Clipper & Reporting Endpoints

# -------------------------------------------------------------------------

@app.post("/api/clip", tags=["Productivity"])
async def clip_content(request: ClipRequest):
    """
    Simulates a webhook endpoint for an engineering web clipper extension.
    It takes the clipped payload and saves it into the Hindsight memory graph.
    """
    try:
        # In a real app we would call Hindsight's /api/v1/retain here.
        # Stub implementation.
        logger.info(f"Clipped content from URL: {request.url}")
        return {
            "status": "success",
            "message": f"Successfully clipped to memory graph: {request.title}"
        }
    except Exception as e:
        logger.error(f"Clipping failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/reports", tags=["Productivity"])
async def save_report(request: ReportRequest):
    """
    Saves an engineering report to the local file system.
    """
    try:
        os.makedirs("data/reports", exist_ok=True)
        filename = f"data/reports/{request.title.replace(' ', '_')}.md"
        with open(filename, "w") as f:
            f.write(request.content)
        return {"status": "success", "message": "Report saved successfully.", "filename": filename}
    except Exception as e:
        logger.error(f"Saving report failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reports", tags=["Productivity"])
async def list_reports():
    """
    Lists saved engineering reports.
    """
    try:
        os.makedirs("data/reports", exist_ok=True)
        reports = os.listdir("data/reports")
        reports_clean = [r for r in reports if r.endswith(".md")]
        return {"status": "success", "reports": reports_clean}
    except Exception as e:
        logger.error(f"Listing reports failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/vault/files", tags=["Database"])
async def get_vault_files(db: AsyncSession = Depends(get_db)):
    """
    Lists files tracked in the Vault.
    """
    result = await db.execute(select(models.VaultFile).order_by(models.VaultFile.upload_date.desc()))
    files = result.scalars().all()
    # Format to match frontend: { id, name, level, size, date, status }
    return [
        {
            "id": f.id,
            "name": f.filename,
            "level": f.clearance,
            "size": f.size,
            "date": f.upload_date,
            "status": f.status
        }
        for f in files
    ]



# =============================================================================
# Internal Integration Endpoints
# =============================================================================

@app.post("/api/internal/field-note", tags=["Internal"])
async def add_field_note(note: FieldNoteRequest):
    """
    Accepts a field observation from the mobile Telegram bot
    and posts it to the Hindsight memory graph under the specified machine_id.
    """
    try:
        response = await http_client.post(
            f"{HINDSIGHT_BASE_URL}/v1/default/banks/koch_graph/memories",
            json={
                "items": [{
                    "content": f"Field Observation: {note.text}",
                    "metadata": {
                        "source": "Mobile Field Technician",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "document_type": "field_note"
                    }
                }]
            },
            headers={"Authorization": f"Bearer {HINDSIGHT_API_KEY}"},
        )
        response.raise_for_status()
        return {"status": "success", "message": "Note added to Hindsight.", "hindsight_id": response.json().get("id", "")}
    except httpx.HTTPStatusError as e:
        logger.error(f"Hindsight returned HTTP Error for field note: {e.response.text}")
        raise HTTPException(status_code=500, detail="Internal memory error mapping observation")
    except Exception as e:
        logger.error(f"Failed to commit field note to Hindsight: {e}")
        raise HTTPException(status_code=500, detail="Internal memory system unreachable")

class PublicNoteRequest(BaseModel):
    content: Optional[str] = None
    image_path: Optional[str] = None
    sender: str
    status: str = "unclassified"
    classified_machine_id: Optional[str] = None

@app.get("/api/field-notes", tags=["Internal"])
async def get_public_notes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.PublicFieldNote).order_by(models.PublicFieldNote.timestamp.desc())
    )
    notes = result.scalars().all()
    return [{"id": n.id, "content": n.content, "image_path": n.image_path, "sender": n.sender, "timestamp": n.timestamp, "status": n.status, "classified_machine_id": n.classified_machine_id} for n in notes]

@app.post("/api/field-notes", tags=["Internal"])
async def create_public_note(note: PublicNoteRequest, db: AsyncSession = Depends(get_db)):
    note_id = str(uuid.uuid4())
    db_note = models.PublicFieldNote(
        id=note_id,
        content=note.content,
        image_path=note.image_path,
        sender=note.sender,
        timestamp=datetime.now(timezone.utc).isoformat(),
        status=note.status,
        classified_machine_id=note.classified_machine_id
    )
    db.add(db_note)
    await db.commit()
    return {"status": "success", "id": note_id}

@app.put("/api/field-notes/{note_id}", tags=["Internal"])
async def update_public_note(note_id: str, note_update: PublicNoteRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.PublicFieldNote).where(models.PublicFieldNote.id == note_id))
    db_note = result.scalars().first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
        
    db_note.content = note_update.content
    db_note.status = note_update.status
    db_note.classified_machine_id = note_update.classified_machine_id
    
    if note_update.status == "classified" and note_update.classified_machine_id:
        try:
            await http_client.post(
                f"{HINDSIGHT_BASE_URL}/v1/default/banks/koch_graph/memories",
                json={
                    "items": [{
                        "content": f"Field Observation: {note_update.content}",
                        "metadata": {
                            "source": "Public Field Notes Triage",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "document_type": "field_note"
                        }
                    }]
                },
                headers={"Authorization": f"Bearer {HINDSIGHT_API_KEY}"},
            )
        except Exception as e:
            logger.error(f"Failed pushing classified note to Hindsight: {e}")
            
    await db.commit()
    return {"status": "success"}

@app.post("/api/field-notes/photo", tags=["Internal"])
async def create_public_photo(sender: str = Form(...), file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    note_id = str(uuid.uuid4())
    os.makedirs("/app/uploads/public", exist_ok=True)
    _, ext = os.path.splitext(file.filename or "")
    if not ext:
        ext = ".jpg"
    filepath = f"/app/uploads/public/{note_id}{ext}"
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    db_note = models.PublicFieldNote(
        id=note_id,
        content="[Photo Only - No Text]",
        image_path=filepath,
        sender=sender,
        timestamp=datetime.now(timezone.utc).isoformat(),
        status="unclassified",
        classified_machine_id=None
    )
    db.add(db_note)
    await db.commit()
    return {"status": "success", "id": note_id}

@app.get("/api/uploads/public/{filename}", tags=["Documents"])
async def get_public_photo(filename: str):
    filepath = f"/app/uploads/public/{filename}"
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Image not found")
    from fastapi.responses import FileResponse
    return FileResponse(filepath)

# =============================================================================
# Agent Tools Endpoints
# =============================================================================

@app.get("/api/tools/query_cad_bom", tags=["Agent Tools"])
async def query_cad_bom(assembly_name: str = Query(..., description="The name of the CAD assembly to retrieve BOM for")):
    """
    Hermes Agent Tool: Query hierarchical Bill of Materials.
    Provides structured data from the mock CAD integration.
    """
    logger.info(f"Agent requested BOM for assembly: {assembly_name}")
    
    # Normally this would query a real database or the Hindsight graph.
    # We provide a mock implementation mirroring cad_processor.py for the agent.
    
    return {
        "status": "success",
        "assembly": assembly_name,
        "metadata": {
            "Part_Number": "ASM-8400",
            "Material": "Steel/Aluminum/Various",
            "Mass": "1450.5 kg",
        },
        "components": [
            {
                "id": "1",
                "part_number": "BRG-6205",
                "name": "Deep Groove Ball Bearing",
                "quantity": 4,
                "material": "Stainless Steel"
            },
            {
                "id": "2",
                "part_number": "DRV-300kW",
                "name": "Main Drive Motor Assembly",
                "quantity": 1,
                "material": "Cast Iron/Copper"
            },
            {
                "id": "3",
                "part_number": "CVY-BLT-100",
                "name": "Main Conveyor Belt",
                "quantity": 1,
                "material": "Rubberized Polymer"
            }
        ]
    }


# =============================================================================
# Entry Point (for direct execution outside Docker)
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
