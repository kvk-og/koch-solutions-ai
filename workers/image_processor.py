import os
import io
import json
import uuid
import logging
from datetime import datetime, timezone
import requests
import exifread
from PIL import Image
from celery import Celery

# =============================================================================
# Configuration
# =============================================================================

# Redis broker URL
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

HINDSIGHT_BASE_URL = os.getenv("HINDSIGHT_BASE_URL", "http://hindsight:8100")
HINDSIGHT_API_KEY = os.getenv("HINDSIGHT_API_KEY", "koch-hindsight-key")
VLLM_BASE_URL = os.getenv("VLLM_BASE_URL", "https://api.ingham.ai/v1")
VLLM_API_KEY = os.getenv("VLLM_API_KEY", "inghamai-8101997")
LLM_MODEL = os.getenv("LLM_MODEL", "google/gemma-4-26B-A4B-it")


logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("koch-image-processor")

# =============================================================================
# Celery App Initialization
# =============================================================================

celery_app = Celery("image_processor", broker=REDIS_URL, backend=REDIS_URL)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

# =============================================================================
# Pipeline Components
# =============================================================================

def extract_exif_metadata(filepath: str) -> dict:
    """
    Extract standard EXIF metadata from the image using exifread and PIL.
    """
    metadata = {}
    
    try:
        # ExifRead for detailed extraction
        with open(filepath, "rb") as f:
            tags = exifread.process_file(f, details=False)
            
            # Extract common useful tags
            if "Image DateTime" in tags:
                metadata["DateTime"] = str(tags["Image DateTime"])
            if "Image Make" in tags:
                metadata["CameraMake"] = str(tags["Image Make"])
            if "Image Model" in tags:
                metadata["CameraModel"] = str(tags["Image Model"])
            
            # Simple GPS extraction (if present)
            if "GPS GPSLatitude" in tags and "GPS GPSLongitude" in tags:
                metadata["GPSLatitude"] = str(tags["GPS GPSLatitude"])
                metadata["GPSLongitude"] = str(tags["GPS GPSLongitude"])
    except Exception as e:
        logger.warning(f"Error reading EXIF data: {e}")

    try:
        # PIL for basic image specs
        with Image.open(filepath) as img:
            metadata["Format"] = img.format
            metadata["Size"] = {"width": img.width, "height": img.height}
            metadata["Mode"] = img.mode
    except Exception as e:
        logger.warning(f"Error reading basic image specs: {e}")

    return metadata

def analyze_image_content(filepath: str) -> str:
    """
    Pass the image to the local VLM (e.g., LLaVA or a Vision-capable LLM)
    to generate a descriptive text summary of physical damage or machine state.
    """
    import base64
    from openai import OpenAI
    
    logger.info(f"Sending visual query to VLM for {filepath}...")
    
    try:
        with open(filepath, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
            
        client = OpenAI(base_url=VLLM_BASE_URL, api_key=VLLM_API_KEY)
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional industrial field engineer. Analyze this raw field photo. Briefly summarize any visible equipment, damage, context, or abnormalities."
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "What do you see in this field photo?"},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{encoded_string}"}}
                    ]
                }
            ],
            max_tokens=512,
            temperature=0.2
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"VLM Analysis Failed: {e}")
        return f"VLM Analysis Failed: {str(e)}"


def create_visual_field_report(filepath: str, machine_id: str) -> dict:
    """
    Combines extracted EXIF metadata and VLM text description into a
    structured JSON/Markdown payload.
    """
    exif_data = extract_exif_metadata(filepath)
    vlm_summary = analyze_image_content(filepath)
    
    report_content = (
        f"📋 **Visual Field Report: {machine_id}**\n\n"
        f"**AI Diagnostics (VLM Analysis):**\n{vlm_summary}\n\n"
        f"**Photo Metadata:**\n"
    )
    
    for key, value in exif_data.items():
        report_content += f"- **{key}:** {value}\n"
        
    payload = {
        "content": report_content,
        "namespace": "field_observations",
        "metadata": {
            "Type": "Field Photo",
            "Source": "Camera",
            "Machine_ID": machine_id,
            "filename": os.path.basename(filepath),
            "ingested_at": datetime.now(timezone.utc).isoformat()
        }
    }
    
    return payload

@celery_app.task(name="image_processor.process_photo_task", bind=True, max_retries=3)
def process_photo_task(self, filepath: str, machine_id: str):
    """
    Celery task to process an uploaded photo, extract data, and post to Hindsight.
    """
    logger.info(f"Started photo processing task for Machine: {machine_id}, File: {filepath}")
    
    if not os.path.exists(filepath):
        error_msg = f"File not found: {filepath}"
        logger.error(error_msg)
        raise ValueError(error_msg)
        
    try:
        # Create the report combining EXIF and VLM mock
        report_payload = create_visual_field_report(filepath, machine_id)
        
        # Post to Hindsight Retain API
        response = requests.post(
            f"{HINDSIGHT_BASE_URL}/v1/retain",
            json=report_payload,
            headers={"Authorization": f"Bearer {HINDSIGHT_API_KEY}"},
            timeout=30.0
        )
        response.raise_for_status()
        
        logger.info(f"Successfully committed field report for {machine_id} to Hindsight.")
        
        # Optionally, clean up the file after processing
        os.remove(filepath)
        logger.info(f"Cleaned up temporary file: {filepath}")
        
        return {"status": "success", "machine_id": machine_id}

    except requests.RequestException as e:
        logger.error(f"Hindsight API error during photo ingestion: {e}")
        raise self.retry(exc=e, countdown=60, max_retries=3)
    except Exception as e:
        logger.error(f"Error processing photo for {machine_id}: {e}")
        raise
