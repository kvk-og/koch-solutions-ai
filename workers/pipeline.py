"""
=============================================================================
KOCH AI — Document Ingestion Pipeline (pipeline.py)
=============================================================================
Background worker service that handles two extraction pipelines:

  1. DOCLING PIPELINE — Structured parsing of PDFs, DOCX, spreadsheets
     Extracts text, tables, metadata, and hierarchical structure.
     Commits parsed content to Hindsight temporal memory.

  2. VLM PIPELINE — Visual Language Model extraction for schematics
     Sends images/CAD renders to vLLM for visual understanding.
     Extracts equipment tags, P&ID symbols, wiring details.
     Commits extracted knowledge to Hindsight.

Architecture:
  ┌──────────┐     ┌───────────┐     ┌───────────┐
  │  Backend  │────▶│  Workers  │────▶│ Hindsight │
  │   API     │     │ (this)    │     │  Memory   │
  └──────────┘     │           │────▶│  Graph    │
                   │           │     └───────────┘
                   │           │────▶│   vLLM    │
                   └───────────┘     └───────────┘
=============================================================================
"""

import os
import io
import json
import uuid
import logging
import hashlib
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel, Field
from openai import AsyncOpenAI

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

# =============================================================================
# Configuration
# =============================================================================

HINDSIGHT_BASE_URL = os.getenv("HINDSIGHT_BASE_URL", "http://hindsight:8888")
HINDSIGHT_API_KEY = os.getenv("HINDSIGHT_API_KEY", "koch-hindsight-key")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai")
LLM_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("LLM_API_KEY")
if not LLM_API_KEY:
    raise RuntimeError("GEMINI_API_KEY environment variable is required.")
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-3.1-flash-lite-preview")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("koch-workers")

# =============================================================================
# FastAPI Application
# =============================================================================

app = FastAPI(
    title="KOCH AI — Document Ingestion Workers",
    version="1.0.0",
)

# Async clients
http_client: Optional[httpx.AsyncClient] = None
vllm_client: Optional[AsyncOpenAI] = None


@app.on_event("startup")
async def startup():
    global http_client, vllm_client
    http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(120.0, connect=10.0),
        headers={"Content-Type": "application/json"},
    )
    vllm_client = AsyncOpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)
    logger.info(f"Worker pipeline started — model: {LLM_MODEL}")


@app.on_event("shutdown")
async def shutdown():
    if http_client:
        await http_client.aclose()
    logger.info("Worker pipeline shut down")


# =============================================================================
# Hindsight Memory Commit
# =============================================================================

async def commit_to_hindsight(
    content: str,
    metadata: dict,
    namespace: str = "documents",
) -> dict:
    """
    Commit a parsed document fragment to the Hindsight temporal memory graph.

    This is the critical integration point: every piece of extracted knowledge
    gets stored in Hindsight with rich metadata for temporal + entity retrieval.

    The Hindsight "Retain" API accepts:
      - content:   The text/knowledge to memorize
      - namespace:  Logical grouping (e.g., by project, document type)
      - metadata:   Arbitrary key-value pairs for filtering and provenance

    Example payload sent to Hindsight:
    {
        "content": "Pump P-101 is a centrifugal pump rated at 500 GPM...",
        "namespace": "documents",
        "metadata": {
            "source": "operations-manual-v3.pdf",
            "page": 42,
            "section": "Equipment Specifications",
            "document_type": "manual",
            "entities": ["P-101", "centrifugal pump"],
            "timestamp": "2024-01-15T10:30:00Z",
            "content_hash": "sha256:abc123..."
        }
    }
    """
    payload = {
        "items": [{
            "content": content,
            "metadata": {
                "page": "",
                **metadata,
                "ingested_at": datetime.now(timezone.utc).isoformat(),
                "content_hash": f"sha256:{hashlib.sha256(content.encode()).hexdigest()[:16]}",
            }
        }]
    }

    try:
        response = await http_client.post(
            f"{HINDSIGHT_BASE_URL}/v1/default/banks/koch_graph/memories",
            json=payload,
            headers={"Authorization": f"Bearer {HINDSIGHT_API_KEY}"},
        )
        response.raise_for_status()
        result = response.json()
        logger.info(
            f"Committed to Hindsight: namespace={namespace}, "
            f"content_length={len(content)}, "
            f"memory_id={result.get('id', 'unknown')}"
        )
        return result

    except httpx.HTTPStatusError as e:
        logger.error(f"Hindsight commit failed (HTTP {e.response.status_code}): {e.response.text}")
        raise
    except Exception as e:
        logger.error(f"Hindsight commit error: {e}")
        raise


# =============================================================================
# Pipeline 1: Docling — Structured Document Parsing
# =============================================================================

async def parse_with_docling(file_bytes: bytes, filename: str) -> list[dict]:
    """
    Parse a standard document (PDF, DOCX, etc.) using Docling.

    Docling extracts:
      - Full text with structural hierarchy (headings, paragraphs)
      - Tables as structured data
      - Metadata (author, creation date, revision)
      - Page-level segmentation

    In production, this would use the docling library directly:

        from docling.document_converter import DocumentConverter
        converter = DocumentConverter()
        result = converter.convert(source)
        doc = result.document

    For this stub, we simulate the parsing output to demonstrate
    the integration pattern with Hindsight.

    Args:
        file_bytes: Raw file content
        filename: Original filename for metadata

    Returns:
        List of parsed document chunks ready for Hindsight commit
    """
    logger.info(f"[DOCLING] Parsing document: {filename} ({len(file_bytes)} bytes)")

    import hashlib
    file_hash = hashlib.sha256(file_bytes).hexdigest()[:16]

    # ── PRODUCTION IMPLEMENTATION ──
    try:
        from docling.document_converter import DocumentConverter
        
        # Write bytes to a temporary file for docling
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=os.path.splitext(filename)[1], delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name
            
        try:
            import asyncio
            converter = DocumentConverter()
            result = await asyncio.to_thread(converter.convert, tmp_path)
            doc = result.document
            
            # ── PRIMARY APPROACH: Export the whole document as markdown ──
            # This is the most reliable Docling 2.x API for full text extraction.
            full_text = doc.export_to_markdown()
            
            if full_text and full_text.strip():
                # Split into reasonable chunks (~2000 chars each) for Hindsight
                chunk_size = 2000
                text_chunks = []
                for start in range(0, len(full_text), chunk_size):
                    segment = full_text[start:start + chunk_size].strip()
                    if segment:
                        text_chunks.append(segment)
                
                parsed_chunks = []
                for i, segment in enumerate(text_chunks):
                    meta = {
                        "source": filename,
                        "section": f"chunk_{i+1}_of_{len(text_chunks)}",
                        "document_type": "parsed",
                        "file_hash": file_hash,
                        "parser": "docling",
                    }
                    parsed_chunks.append({"content": segment, "metadata": meta})
                    
                logger.info(f"[DOCLING] Extracted {len(parsed_chunks)} chunks ({len(full_text)} chars total) from {filename}")
            else:
                logger.warning(f"[DOCLING] export_to_markdown() returned empty for {filename}")
                parsed_chunks = [{
                    "content": f"Document {filename} was parsed but contained no extractable text.",
                    "metadata": {"source": filename, "status": "empty", "file_hash": file_hash, "parser": "docling"}
                }]
        finally:
            os.unlink(tmp_path)
            
    except Exception as e:
        logger.error(f"[DOCLING] parsing failed for {filename}: {e}", exc_info=True)
        parsed_chunks = [{
            "content": f"Failed to parse document {filename}",
            "metadata": {"source": filename, "status": "error", "file_hash": file_hash, "parser": "docling"}
        }]

    logger.info(f"[DOCLING] Extracted {len(parsed_chunks)} chunks from {filename}")
    return parsed_chunks


# =============================================================================
# Pipeline 2: VLM — Visual Language Model Extraction
# =============================================================================

async def extract_with_vlm(file_bytes: bytes, filename: str) -> list[dict]:
    """
    Process visual content (schematics, P&IDs, CAD renders) through the
    Visual Language Model running on vLLM.

    The VLM analyzes images to extract:
      - Equipment tags and identifiers (e.g., P-101, V-201)
      - P&ID symbol recognition (valves, instruments, vessels)
      - Wiring diagrams and connection topology
      - Dimensional annotations
      - Bill of Materials from assembly drawings

    In production with a multimodal model (e.g., LLaVA, Qwen-VL),
    images are sent directly to the model. For text-only models,
    we describe the image metadata and extracted OCR text.

    Args:
        file_bytes: Raw image/CAD file content
        filename: Original filename for metadata

    Returns:
        List of extracted knowledge chunks ready for Hindsight commit
    """
    logger.info(f"[VLM] Processing visual content: {filename} ({len(file_bytes)} bytes)")

    file_hash = hashlib.sha256(file_bytes).hexdigest()[:16]

    # ── PRODUCTION IMPLEMENTATION ──
    try:
        import base64
        # Detect MIME type from file extension for correct base64 data URI
        ext = os.path.splitext(filename)[1].lower().lstrip(".")
        mime_map = {
            "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "png": "image/png", "tiff": "image/tiff", "tif": "image/tiff",
            "bmp": "image/bmp", "webp": "image/webp", "svg": "image/svg+xml",
        }
        mime_type = mime_map.get(ext, "image/png")
        image_b64 = base64.b64encode(file_bytes).decode("utf-8")
        
        response = await vllm_client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert engineering document analyzer. "
                        "Extract all equipment tags, specifications, connections, "
                        "and annotations from this engineering diagram. "
                        "Format your output as structured text."
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": f"Analyze this engineering diagram: {filename}"},
                        {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{image_b64}"}},
                    ],
                },
            ],
            max_completion_tokens=2048,
            temperature=0.1,  # Low temperature for factual extraction
        )
        
        extracted_text = response.choices[0].message.content

        extracted_chunks = [
            {
                "content": f"[VLM Analysis of {filename}]\n\n{extracted_text}",
                "metadata": {
                    "source": filename,
                    "document_type": "schematic",
                    "file_hash": file_hash,
                    "parser": "vlm",
                    "extraction_confidence": 0.85,
                },
            },
        ]

        logger.info(f"[VLM] Extraction complete: {len(extracted_chunks)} chunks from {filename}")
        return extracted_chunks

    except Exception as e:
        logger.error(f"[VLM] Extraction failed for {filename}: {e}")
        # Return a minimal chunk with the error for traceability
        return [
            {
                "content": f"VLM extraction failed for {filename}: {str(e)}",
                "metadata": {
                    "source": filename,
                    "document_type": "schematic",
                    "file_hash": file_hash,
                    "parser": "vlm",
                    "status": "error",
                },
            },
        ]


# =============================================================================
# API Endpoints
# =============================================================================

@app.get("/health")
async def health():
    """Worker health check."""
    return {
        "status": "healthy",
        "service": "koch-workers",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "pipelines": ["docling", "vlm"],
    }


@app.post("/ingest/docling")
async def ingest_docling(request: Request):
    """
    Docling ingestion endpoint.

    Called by the backend API when a standard document (PDF, DOCX, etc.)
    is uploaded. Parses the document and commits chunks to Hindsight.
    """
    file_bytes = await request.body()
    filename = request.headers.get("X-File-Name", "unknown")
    file_id = request.headers.get("X-File-ID", str(uuid.uuid4()))

    logger.info(f"[DOCLING] Ingestion started: {filename} (ID: {file_id})")

    # Parse the document
    chunks = await parse_with_docling(file_bytes, filename)

    # ── Commit to Hindsight using the proper Retain API ──
    # Per https://hindsight.vectorize.io/developer/api/retain:
    # - Each item.content is analyzed by Hindsight's LLM to extract facts
    # - document_id makes retain idempotent (re-upload replaces old memories)
    # - context shapes how facts are extracted
    # - metadata provides provenance for filtering
    committed = 0
    if chunks:
        # Hindsight handles its own chunking/fact extraction, so we should
        # send larger content blocks rather than many tiny ones.
        # Combine all parsed chunks into items, grouping into ~50k char blocks
        # to stay within Hindsight's processing limits.
        MAX_ITEM_CHARS = 50000
        items = []
        current_block = []
        current_length = 0
        
        for chunk in chunks:
            content = chunk["content"]
            if current_length + len(content) > MAX_ITEM_CHARS and current_block:
                items.append("\n\n".join(current_block))
                current_block = []
                current_length = 0
            current_block.append(content)
            current_length += len(content)
        if current_block:
            items.append("\n\n".join(current_block))
        
        # Build the retain request — one document_id per file for idempotency
        retain_items = []
        for i, block in enumerate(items):
            item = {
                "content": block,
                "document_id": f"{file_id}" if len(items) == 1 else f"{file_id}-part{i+1}",
                "context": "engineering document",
                "metadata": {
                    "source": filename,
                    "file_id": file_id,
                    "parser": "docling",
                    "page": "",
                    "ingested_at": datetime.now(timezone.utc).isoformat(),
                },
            }
            retain_items.append(item)
        
        try:
            response = await http_client.post(
                f"{HINDSIGHT_BASE_URL}/v1/default/banks/koch_graph/memories",
                json={"items": retain_items},
                headers={"Authorization": f"Bearer {HINDSIGHT_API_KEY}"},
                timeout=httpx.Timeout(None),  # No timeout: Local LLM fact extraction takes time
            )
            response.raise_for_status()
            result = response.json()
            committed = len(retain_items)
            logger.info(
                f"Hindsight retain success: {committed} items for {filename}, "
                f"total_chars={sum(len(b) for b in items)}"
            )
        except httpx.HTTPStatusError as e:
            logger.error(f"Hindsight retain failed (HTTP {e.response.status_code}): {e.response.text[:500]}")
        except Exception as e:
            logger.error(f"Hindsight retain error: {e}", exc_info=True)

    return {
        "file_id": file_id,
        "filename": filename,
        "pipeline": "docling",
        "chunks_parsed": len(chunks),
        "items_retained": committed,
        "status": "complete",
    }


@app.post("/ingest/vlm")
async def ingest_vlm(request: Request):
    """
    VLM ingestion endpoint.

    Called by the backend API when a visual document (schematic, CAD,
    P&ID image) is uploaded. Extracts knowledge via the VLM and
    commits it to Hindsight.
    """
    file_bytes = await request.body()
    filename = request.headers.get("X-File-Name", "unknown")
    file_id = request.headers.get("X-File-ID", str(uuid.uuid4()))

    logger.info(f"[VLM] Ingestion started: {filename} (ID: {file_id})")

    # Extract knowledge from the visual content
    chunks = await extract_with_vlm(file_bytes, filename)

    # Commit each chunk to Hindsight memory
    committed = []
    for chunk in chunks:
        try:
            result = await commit_to_hindsight(
                content=chunk["content"],
                metadata={**chunk["metadata"], "file_id": file_id},
                namespace="documents",
            )
            committed.append(result)
        except Exception as e:
            logger.error(f"Failed to commit chunk to Hindsight: {e}")

    return {
        "file_id": file_id,
        "filename": filename,
        "pipeline": "vlm",
        "chunks_extracted": len(chunks),
        "chunks_committed": len(committed),
        "status": "complete",
    }
