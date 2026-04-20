from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from app.services.join_engine import propose_joins, apply_join

router = APIRouter(prefix="/api/joins", tags=["joins"])


class ProposeRequest(BaseModel):
    extracted_texts: List[str]


class ApplyJoinRequest(BaseModel):
    extracted_texts: List[str]
    left_index: int
    right_index: int
    left_col: str
    right_col: str
    how: str = "inner"


@router.post("/propose")
async def propose(request: ProposeRequest):
    """Propose join keys between multiple uploaded files."""
    if len(request.extracted_texts) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 files to propose joins")
    try:
        proposals = propose_joins(request.extracted_texts)
        return {"proposals": proposals}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/apply")
async def apply(request: ApplyJoinRequest):
    """Apply a join and return merged extracted_text."""
    try:
        merged_csv = apply_join(
            request.extracted_texts,
            request.left_col,
            request.right_col,
            request.left_index,
            request.right_index,
            request.how,
        )
        return {"extracted_text": merged_csv}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
