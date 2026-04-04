from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from pydantic import BaseModel
from pathlib import Path
import shutil
import os
from app.services.file_parser import FileParser

router = APIRouter(prefix="/api", tags=["upload"])

# Configure upload directory
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Max file size: 25MB for MVP
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".docx", ".pdf", ".json"}


class UploadResponse(BaseModel):
    success: bool
    file_name: str
    file_size: int
    file_type: str
    extracted_text: str
    file_schema: dict = None  # Renamed from 'schema' to avoid shadowing


class UploadErrorResponse(BaseModel):
    success: bool
    error: str


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
) -> UploadResponse:
    """
    Upload a file (CSV, Excel, Word, PDF, or JSON) and extract its content.

    Returns extracted text and schema metadata for Claude analysis.
    """

    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type {file_ext} not supported. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    try:
        # Read file content
        content = await file.read()

        # Validate file size
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File size exceeds {MAX_FILE_SIZE / 1024 / 1024}MB limit"
            )

        # Parse file
        extracted_text, schema = await FileParser.parse_file(content, file.filename)

        # Save file to uploads directory (optional, for record-keeping)
        file_path = UPLOAD_DIR / file.filename
        with open(file_path, "wb") as f:
            f.write(content)

        # Schedule cleanup after 24 hours
        background_tasks.add_task(cleanup_file, file_path)

        return UploadResponse(
            success=True,
            file_name=file.filename,
            file_size=len(content),
            file_type=file_ext,
            extracted_text=extracted_text,
            file_schema=schema,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


async def cleanup_file(file_path: Path):
    """Remove uploaded file after processing"""
    try:
        if file_path.exists():
            file_path.unlink()
    except Exception as e:
        print(f"Error cleaning up file {file_path}: {e}")


@router.get("/health/upload")
async def upload_health():
    """Health check for upload service"""
    return {
        "status": "ok",
        "allowed_extensions": list(ALLOWED_EXTENSIONS),
        "max_file_size_mb": MAX_FILE_SIZE / 1024 / 1024
    }
