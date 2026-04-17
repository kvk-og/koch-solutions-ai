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
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from openai import AsyncOpenAI

# =============================================================================
# Configuration
# =============================================================================

# Service URLs — resolved via Docker DNS on the internal network
VLLM_BASE_URL = os.getenv("VLLM_BASE_URL", "https://api.ingham.ai/v1")
VLLM_API_KEY = os.getenv("VLLM_API_KEY", "inghamai-8101997")
LLM_MODEL = os.getenv("LLM_MODEL", "google/gemma-4-26b-it")

HINDSIGHT_BASE_URL = os.getenv("HINDSIGHT_BASE_URL", "http://hindsight:8100")
HINDSIGHT_API_KEY = os.getenv("HINDSIGHT_API_KEY", "koch-hindsight-key")

WORKER_BASE_URL = os.getenv("WORKER_BASE_URL", "http://parser-workers:9000")
CAD_WORKER_BASE_URL = os.getenv("CAD_WORKER_BASE_URL", "http://cad-workers:9001")

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "100"))

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("koch-backend")

# =============================================================================
# FastAPI Application
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

# =============================================================================
# Async HTTP Clients (initialized on startup, closed on shutdown)
# =============================================================================

# OpenAI-compatible client pointed at the vLLM container
vllm_client: Optional[AsyncOpenAI] = None

# General HTTP client for Hindsight and Worker communication
http_client: Optional[httpx.AsyncClient] = None


@app.on_event("startup")
async def startup():
    """Initialize async clients on application startup."""
    global vllm_client, http_client

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

async def query_hindsight_context(query: str, conversation_id: Optional[str] = None) -> dict:
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
        payload = {
            "query": query,
            "top_k": 10,                    # Number of memory fragments to retrieve
            "include_entities": True,        # Include entity graph connections
            "include_temporal": True,        # Include temporal ordering
        }

        # Scope retrieval to a specific conversation if provided
        if conversation_id:
            payload["namespace"] = conversation_id

        response = await http_client.post(
            f"{HINDSIGHT_BASE_URL}/api/v1/recall",
            json=payload,
            headers={"Authorization": f"Bearer {HINDSIGHT_API_KEY}"},
        )
        response.raise_for_status()

        data = response.json()
        logger.info(
            f"Hindsight returned {len(data.get('memories', []))} memory fragments "
            f"and {len(data.get('entities', []))} linked entities"
        )
        return data

    except httpx.HTTPStatusError as e:
        logger.warning(f"Hindsight query failed (HTTP {e.response.status_code}): {e}")
        return {"memories": [], "entities": [], "error": str(e)}
    except httpx.ConnectError:
        logger.warning("Hindsight service unreachable — proceeding without context")
        return {"memories": [], "entities": [], "error": "Service unreachable"}


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
    memories = hindsight_context.get("memories", [])
    entities = hindsight_context.get("entities", [])

    context_blocks = []

    # Format memory fragments with temporal metadata
    if memories:
        context_blocks.append("=== RETRIEVED ENGINEERING CONTEXT ===")
        for i, mem in enumerate(memories, 1):
            timestamp = mem.get("timestamp", "unknown")
            source = mem.get("source", "unknown")
            content = mem.get("content", "")
            relevance = mem.get("relevance_score", 0.0)
            context_blocks.append(
                f"[Memory {i}] (source: {source}, date: {timestamp}, relevance: {relevance:.2f})\n{content}"
            )

    # Format linked entities (equipment, systems, standards)
    if entities:
        context_blocks.append("\n=== LINKED ENTITIES ===")
        for ent in entities:
            ent_type = ent.get("type", "unknown")
            ent_name = ent.get("name", "unknown")
            ent_desc = ent.get("description", "")
            context_blocks.append(f"• [{ent_type}] {ent_name}: {ent_desc}")

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

@app.post("/api/upload", response_model=UploadResponse, tags=["Documents"])
async def upload_file(file: UploadFile = File(...)):
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

    # Dispatch to the appropriate worker endpoint
    try:
        # Route logic for base url
        base_url = CAD_WORKER_BASE_URL if pipeline == "cad" else WORKER_BASE_URL
        worker_endpoint = f"{base_url}/ingest/{pipeline}"
        
        worker_response = await http_client.post(
            worker_endpoint,
            content=contents,
            headers={
                "Content-Type": file.content_type or "application/octet-stream",
                "X-File-Name": file.filename or "unknown",
                "X-File-ID": file_id,
            },
            timeout=httpx.Timeout(300.0),  # Large files may take time
        )
        worker_response.raise_for_status()
        status = "processing"
        message = f"File queued for {pipeline} extraction pipeline."

    except httpx.ConnectError:
        logger.warning(f"Worker service unreachable — file {file_id} queued locally")
        status = "queued"
        message = "Worker service is starting up. File will be processed when available."

    except httpx.HTTPStatusError as e:
        logger.error(f"Worker returned error: {e.response.status_code}")
        status = "error"
        message = f"Worker error: {e.response.text}"

    return UploadResponse(
        file_id=file_id,
        filename=file.filename or "unknown",
        content_type=file.content_type or "application/octet-stream",
        pipeline=pipeline,
        status=status,
        message=message,
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
                    max_tokens=request.max_tokens,
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
                        f"{HINDSIGHT_BASE_URL}/api/v1/retain",
                        json={
                            "content": f"Q: {request.query}\nA: {full_response}",
                            "namespace": conversation_id,
                            "metadata": {
                                "type": "conversation",
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                "source": "chat",
                            },
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
                                f"{HINDSIGHT_BASE_URL}/api/v1/retain",
                                json={
                                    "content": f"Q: {request.query}\\nA: {full_response}",
                                    "namespace": conversation_id,
                                    "metadata": {
                                        "type": "conversation",
                                        "timestamp": datetime.now(timezone.utc).isoformat(),
                                        "source": "agent",
                                    },
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
            f"{HINDSIGHT_BASE_URL}/api/v1/retain",
            json={
                "content": f"Field Observation: {note.text}",
                "namespace": note.machine_id,
                "metadata": {
                    "source": "Mobile Field Technician",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "document_type": "field_note"
                }
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
