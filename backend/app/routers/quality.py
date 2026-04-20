import logging
from fastapi import APIRouter, HTTPException
from io import StringIO
from typing import Optional
import pandas as pd
from pydantic import BaseModel

from app.services.data_quality import DataQuality

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/quality", tags=["quality"])


class QualityAnalyzeRequest(BaseModel):
    extracted_text: str


class QualityFixRequest(BaseModel):
    extracted_text: str
    fixes: dict


@router.post("/analyze")
async def analyze_data_quality(request: QualityAnalyzeRequest):
    """
    Analyze data quality issues in extracted text.
    Returns findings for nulls, duplicates, outliers, type issues.
    """
    try:
        df = pd.read_csv(StringIO(request.extracted_text))
        findings = DataQuality.analyze(df)
        return findings
    except pd.errors.ParserError:
        # Non-CSV file (Excel, PDF, Word) — return clean findings, skip check
        return {
            "total_rows": 0, "total_columns": 0,
            "nulls": [], "duplicates": {"count": 0, "percentage": 0, "suggestion": "Non-CSV file, quality check skipped"},
            "outliers": [], "type_issues": [], "suspicious_values": []
        }
    except Exception as e:
        logger.error(f"Data quality analysis failed: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to analyze data: {str(e)}")


@router.post("/fix")
async def apply_data_fixes(request: QualityFixRequest):
    """
    Apply data quality fixes to extracted text.
    Returns cleaned extracted_text and updated findings.
    """
    try:
        df = pd.read_csv(StringIO(request.extracted_text))
        cleaned_df = DataQuality.apply_fixes(df, request.fixes)
        cleaned_csv = cleaned_df.to_csv(index=False)
        new_findings = DataQuality.analyze(cleaned_df)
        return {
            "extracted_text": cleaned_csv,
            "findings": new_findings,
            "rows_remaining": len(cleaned_df),
        }
    except Exception as e:
        logger.error(f"Data quality fix failed: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to fix data: {str(e)}")
