import logging
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from io import StringIO
import pandas as pd

from app.database import get_db
from app.dependencies import get_current_user
from app.models.dashboard import Dashboard
from app.services.data_quality import DataQuality

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/quality", tags=["quality"])


@router.post("/analyze")
async def analyze_data_quality(
    extracted_text: str,
    user_id: str = Depends(get_current_user),
):
    """
    Analyze data quality issues in extracted text.
    Returns findings for nulls, duplicates, outliers, type issues.
    """
    try:
        # Parse extracted_text as CSV
        df = pd.read_csv(StringIO(extracted_text))
        findings = DataQuality.analyze(df)
        return findings
    except Exception as e:
        logger.error(f"Data quality analysis failed: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to analyze data: {str(e)}")


@router.post("/fix")
async def apply_data_fixes(
    extracted_text: str,
    fixes: dict,  # {"fill_nulls": bool, "drop_duplicates": bool, "coerce_types": bool}
    user_id: str = Depends(get_current_user),
):
    """
    Apply data quality fixes to extracted text.
    Returns cleaned extracted_text and updated findings.
    """
    try:
        # Parse extracted_text as CSV
        df = pd.read_csv(StringIO(extracted_text))

        # Apply fixes
        cleaned_df = DataQuality.apply_fixes(df, fixes)

        # Convert back to CSV string
        cleaned_csv = cleaned_df.to_csv(index=False)

        # Re-analyze
        new_findings = DataQuality.analyze(cleaned_df)

        return {
            "extracted_text": cleaned_csv,
            "findings": new_findings,
            "rows_remaining": len(cleaned_df),
        }

    except Exception as e:
        logger.error(f"Data quality fix failed: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to fix data: {str(e)}")
