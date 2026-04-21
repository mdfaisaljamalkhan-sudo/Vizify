from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from pydantic import BaseModel
from pathlib import Path
from typing import Optional
import io
import uuid
import os
from app.services.file_parser import FileParser

router = APIRouter(prefix="/api", tags=["upload"])

# Configure upload directories
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
PARQUET_DIR = Path("uploads/parquets")
PARQUET_DIR.mkdir(exist_ok=True)

# Max file size: 25MB for MVP
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".docx", ".pdf", ".json"}
TABULAR_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json"}


class UploadResponse(BaseModel):
    success: bool
    file_name: str
    file_size: int
    file_type: str
    extracted_text: str
    file_schema: dict = None
    parquet_path: Optional[str] = None  # set for tabular files; used by chat sandbox


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

        # Save raw file + parquet in background — don't block the response
        file_path = UPLOAD_DIR / file.filename
        background_tasks.add_task(_write_and_cleanup, file_path, content)

        parquet_path: Optional[str] = None
        if file_ext in TABULAR_EXTENSIONS:
            # Best-effort parquet; we derive the path deterministically so we can
            # return it immediately even though the write happens in the background.
            import hashlib
            stem = Path(file.filename).stem
            key = f"{stem}_{hashlib.md5(content[:512]).hexdigest()[:8]}.parquet"
            parquet_path = str(PARQUET_DIR / key)
            background_tasks.add_task(_save_parquet_bg, content, file_ext, parquet_path)

        return UploadResponse(
            success=True,
            file_name=file.filename,
            file_size=len(content),
            file_type=file_ext,
            extracted_text=extracted_text,
            file_schema=schema,
            parquet_path=parquet_path,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


def _write_and_cleanup(file_path: Path, content: bytes):
    """Write uploaded bytes then schedule removal (runs in background)."""
    try:
        file_path.write_bytes(content)
        import time; time.sleep(60)  # keep for 1 min in case needed
        if file_path.exists():
            file_path.unlink()
    except Exception:
        pass


def _save_parquet_bg(content: bytes, file_ext: str, dest: str):
    """Background parquet conversion — failures are silent."""
    try:
        import pandas as pd
        if file_ext == '.csv':
            import chardet
            enc = chardet.detect(content).get('encoding', 'utf-8')
            df = pd.read_csv(io.BytesIO(content), encoding=enc)
        elif file_ext in ('.xlsx', '.xls'):
            df = pd.read_excel(io.BytesIO(content))
        elif file_ext == '.json':
            df = pd.read_json(io.BytesIO(content))
        else:
            return
        df.to_parquet(dest, index=False)
    except Exception:
        pass


def _save_parquet(content: bytes, filename: str, file_ext: str) -> Optional[str]:
    """Convert tabular file to parquet and persist it. Returns path string or None on failure."""
    try:
        import pandas as pd
        if file_ext == ".csv":
            import chardet
            enc = chardet.detect(content).get("encoding", "utf-8")
            df = pd.read_csv(io.BytesIO(content), encoding=enc)
        elif file_ext in (".xlsx", ".xls"):
            df = pd.read_excel(io.BytesIO(content))
        elif file_ext == ".json":
            df = pd.read_json(io.BytesIO(content))
        else:
            return None

        stem = Path(filename).stem
        key = f"{stem}_{uuid.uuid4().hex[:8]}.parquet"
        dest = PARQUET_DIR / key
        df.to_parquet(dest, index=False)
        return str(dest)
    except Exception:
        # Parquet save is best-effort; don't fail the upload if pyarrow isn't installed yet
        return None


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
