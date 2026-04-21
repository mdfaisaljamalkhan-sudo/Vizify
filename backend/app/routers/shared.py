from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, asc
from pydantic import BaseModel
import uuid
from datetime import datetime

from app.database import get_db
from app.models import Dashboard
from app.models.dashboard_comment import DashboardComment
from app.services.realtime import event_stream, broadcast
from app.schemas.dashboard import DashboardResponse, DashboardSchema

router = APIRouter(prefix="/api/shared", tags=["shared"])


class CommentCreate(BaseModel):
    author_name: str = "Anonymous"
    text: str


class CommentResponse(BaseModel):
    id: str
    author_name: str
    text: str
    created_at: str


@router.get("/{share_token}", response_model=DashboardResponse)
async def get_shared_dashboard(
    share_token: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a publicly shared dashboard by share token"""
    result = await db.execute(
        select(Dashboard).where(
            (Dashboard.share_token == share_token) & (Dashboard.is_public == True)
        )
    )
    dashboard = result.scalars().first()

    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found or not public")

    return DashboardResponse(
        id=dashboard.id,
        title=dashboard.title,
        file_name=dashboard.file_name,
        file_type=dashboard.file_type,
        dashboard_type=dashboard.dashboard_type,
        dashboard_data=DashboardSchema(**dashboard.dashboard_data),
        is_public=dashboard.is_public,
        share_token=dashboard.share_token,
        created_at=dashboard.created_at.isoformat(),
        updated_at=dashboard.updated_at.isoformat(),
    )


@router.get("/{share_token}/comments", response_model=list[CommentResponse])
async def get_comments(share_token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Dashboard).where(
            (Dashboard.share_token == share_token) & (Dashboard.is_public == True)
        )
    )
    dashboard = result.scalars().first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    comments = await db.execute(
        select(DashboardComment)
        .where(DashboardComment.dashboard_id == dashboard.id)
        .order_by(asc(DashboardComment.created_at))
    )
    return [
        CommentResponse(id=c.id, author_name=c.author_name, text=c.text, created_at=c.created_at.isoformat())
        for c in comments.scalars().all()
    ]


@router.post("/{share_token}/comments", response_model=CommentResponse)
async def add_comment(share_token: str, body: CommentCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Dashboard).where(
            (Dashboard.share_token == share_token) & (Dashboard.is_public == True)
        )
    )
    dashboard = result.scalars().first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Comment cannot be empty")

    comment = DashboardComment(
        id=str(uuid.uuid4()),
        dashboard_id=dashboard.id,
        author_name=body.author_name.strip() or "Anonymous",
        text=body.text.strip()[:1000],
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    result = CommentResponse(
        id=comment.id, author_name=comment.author_name,
        text=comment.text, created_at=comment.created_at.isoformat()
    )
    # Broadcast new comment to all SSE listeners on this share channel
    broadcast(f"share:{share_token}", "comment_added", result.model_dump())
    return result


@router.get("/{share_token}/stream")
async def shared_stream(share_token: str):
    """SSE stream for shared dashboard — receives dashboard_updated, comment_added, viewers events."""
    return StreamingResponse(
        event_stream(f"share:{share_token}"),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
