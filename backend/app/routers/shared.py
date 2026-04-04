from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Dashboard
from app.schemas.dashboard import DashboardResponse, DashboardSchema

router = APIRouter(prefix="/api/shared", tags=["shared"])


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
