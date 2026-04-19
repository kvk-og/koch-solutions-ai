"""
=============================================================================
KOCH AI — CAD Document Ingestion Pipeline (cad_processor.py)
=============================================================================
Background worker service for the CAD Abstraction Pipeline:

  CAD PIPELINE — Parsing of Autodesk Inventor files (.iam, .ipt)
     Extracts mock metadata (iProperties), a hierarchical BOM,
     and simulates generating a .glb file.
     Commits parsed content to Hindsight temporal memory.

=============================================================================
"""

import os
import json
import uuid
import logging
import hashlib
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import FastAPI, Request, HTTPException

# =============================================================================
# Configuration
# =============================================================================

HINDSIGHT_BASE_URL = os.getenv("HINDSIGHT_BASE_URL", "http://hindsight:8100")
HINDSIGHT_API_KEY = os.getenv("HINDSIGHT_API_KEY", "koch-hindsight-key")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("koch-cad-worker")

# =============================================================================
# FastAPI Application
# =============================================================================

app = FastAPI(
    title="KOCH AI — CAD Pipeline Worker",
    version="1.0.0",
)

# Async HTTP client
http_client: Optional[httpx.AsyncClient] = None

@app.on_event("startup")
async def startup():
    global http_client
    http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(120.0, connect=10.0),
        headers={"Content-Type": "application/json"},
    )
    logger.info("CAD worker pipeline started")


@app.on_event("shutdown")
async def shutdown():
    if http_client:
        await http_client.aclose()
    logger.info("CAD worker pipeline shut down")


# =============================================================================
# Hindsight Memory Commit
# =============================================================================

async def commit_to_hindsight(
    content: str,
    metadata: dict,
    namespace: str = "cad_models",
) -> dict:
    payload = {
        "items": [{
            "content": content,
            "metadata": {
                **metadata,
                "ingested_at": datetime.now(timezone.utc).isoformat(),
                "content_hash": f"sha256:{hashlib.sha256(content.encode()).hexdigest()[:16]}",
            }
        }]
    }

    try:
        response = await http_client.post(
            f"{HINDSIGHT_BASE_URL}/v1/default/banks/{namespace}/memories",
            json=payload,
            headers={"Authorization": f"Bearer {HINDSIGHT_API_KEY}"},
        )
        response.raise_for_status()
        result = response.json()
        logger.info(
            f"Committed to Hindsight: namespace={namespace}, "
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
# Pipeline: CAD Mock Extraction 
# =============================================================================

async def process_cad_file(file_bytes: bytes, filename: str) -> list[dict]:
    logger.info(f"[CAD] Processing 3D CAD content: {filename} ({len(file_bytes)} bytes)")
    
    file_hash = hashlib.sha256(file_bytes).hexdigest()[:16]

    # Binary String Heuristic Extraction for Proprietary OLE / CAD files
    import re
    # Find all sequences of 6 or more ASCII printable characters
    ascii_strings = re.findall(b'[\x20-\x7E]{6,}', file_bytes)
    extracted_strings = [s.decode('utf-8', errors='ignore') for s in ascii_strings]
    
    # Filter strings to those that might be metadata (alphanumeric with some structure like hyphens/underscores)
    # This reduces heavy noise from raw binary blocks that just happen to be ascii
    metadata_candidates = []
    for s in extracted_strings:
        # Ignore things that are pure spaces or too repetitive
        s = s.strip()
        if len(s) < 6 or s.count(' ') > len(s) / 2:
            continue
        metadata_candidates.append(s)
        
    # Deduplicate while preserving order
    seen = set()
    unique_candidates = []
    for s in metadata_candidates:
        if s not in seen:
            unique_candidates.append(s)
            seen.add(s)

    bom_content = f"[CAD Model Extracted Binary Data for {filename}]\n\n"
    bom_content += "Discovered Prop/Text Data:\n"
    
    if unique_candidates:
        for idx, candidate in enumerate(unique_candidates[:200]): # Limit to 200 items to avoid massive payloads
            bom_content += f"- {candidate}\n"
    else:
        bom_content += "No readable strings found in binary.\n"

    extracted_chunks = [
        {
            "content": bom_content,
            "metadata": {
                "source": filename,
                "document_type": "cad_assembly",
                "file_hash": file_hash,
                "parser": "cad_heuristic",
                "entities_detected": [],
                "glb_url": None # Cannot dynamically create .glb without translation engine
            },
        },
    ]

    logger.info(f"[CAD] Extraction complete: {len(extracted_chunks)} chunks from {filename}")
    return extracted_chunks


# =============================================================================
# API Endpoints
# =============================================================================

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "koch-cad-worker",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "pipelines": ["cad"],
    }


@app.post("/ingest/cad")
async def ingest_cad(request: Request):
    """
    CAD ingestion endpoint.
    Called by backend API when .iam / .ipt is uploaded.
    """
    file_bytes = await request.body()
    filename = request.headers.get("X-File-Name", "unknown")
    file_id = request.headers.get("X-File-ID", str(uuid.uuid4()))

    logger.info(f"[CAD] Ingestion started: {filename} (ID: {file_id})")

    chunks = await process_cad_file(file_bytes, filename)

    committed = []
    for chunk in chunks:
        try:
            result = await commit_to_hindsight(
                content=chunk["content"],
                metadata={**chunk["metadata"], "file_id": file_id},
                namespace="cad_models",
            )
            committed.append(result)
        except Exception as e:
            logger.error(f"Failed to commit CAD chunk to Hindsight: {e}")

    return {
        "file_id": file_id,
        "filename": filename,
        "pipeline": "cad",
        "glb_url": f"/mock-assets/{filename}.glb",
        "chunks_extracted": len(chunks),
        "chunks_committed": len(committed),
        "status": "complete",
    }
