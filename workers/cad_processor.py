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
        "content": content,
        "namespace": namespace,
        "metadata": {
            **metadata,
            "ingested_at": datetime.now(timezone.utc).isoformat(),
            "content_hash": f"sha256:{hashlib.sha256(content.encode()).hexdigest()[:16]}",
        },
    }

    try:
        response = await http_client.post(
            f"{HINDSIGHT_BASE_URL}/api/v1/retain",
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

    # STUB: Simulated Autodesk Inventor extraction
    # Normally we would use a proprietary tool, Forge API, or other CAD extraction library to parse iProperties and the hierarchy.

    mock_bom = {
        "assembly": filename,
        "properties": {
            "Part Number": "ASM-8400",
            "Material": "Steel/Aluminum/Various",
            "Mass": "1450.5 kg"
        },
        "components": [
            {
                "Item": "1",
                "Part Number": "BRG-6205",
                "Description": "Deep Groove Ball Bearing",
                "Quantity": 4,
                "Material": "Stainless Steel"
            },
            {
                "Item": "2",
                "Part Number": "DRV-300kW",
                "Description": "Main Drive Motor Assembly",
                "Quantity": 1,
                "Material": "Cast Iron/Copper"
            },
            {
                "Item": "3",
                "Part Number": "CVY-BLT-100",
                "Description": "Main Conveyor Belt",
                "Quantity": 1,
                "Material": "Rubberized Polymer"
            }
        ]
    }

    # Format it as text for the LLM to easily understand when retrieved via Hindsight
    bom_content = (
        f"[CAD Model Extracted Data for {filename}]\n\n"
        f"Assembly Properties:\n"
        f"Part Number: {mock_bom['properties']['Part Number']}\n"
        f"Material: {mock_bom['properties']['Material']}\n"
        f"Mass: {mock_bom['properties']['Mass']}\n\n"
        f"Bill of Materials (BOM):\n"
    )
    for comp in mock_bom["components"]:
        bom_content += (
            f"- [Item {comp['Item']}] {comp['Part Number']}: {comp['Description']} "
            f"(Qty: {comp['Quantity']}, Material: {comp['Material']})\n"
        )
        
    extracted_chunks = [
        {
            "content": bom_content,
            "metadata": {
                "source": filename,
                "document_type": "cad_assembly",
                "file_hash": file_hash,
                "parser": "cad",
                "entities_detected": [comp["Part Number"] for comp in mock_bom['components']] + [mock_bom['properties']['Part Number']],
                "glb_url": f"/mock-assets/{filename}.glb"
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
