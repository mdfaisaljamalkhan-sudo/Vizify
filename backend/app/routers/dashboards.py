from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime
import secrets
import json
import uuid

from fastapi.responses import Response
from app.database import get_db, settings
from app.models import Dashboard
from app.services.brief_generator import generate_executive_brief
from app.services.pptx_exporter import generate_pptx
from app.schemas.dashboard import (
    DashboardCreate,
    DashboardUpdate,
    DashboardResponse,
    DashboardListResponse,
    ShareLinkResponse,
    DashboardSchema,
)
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/dashboards", tags=["dashboards"])


@router.post("", response_model=DashboardResponse)
async def create_dashboard(
    dashboard_data: DashboardCreate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a newly analyzed dashboard"""
    try:
        dashboard = Dashboard(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title=dashboard_data.title,
            file_name=dashboard_data.file_name,
            file_type=dashboard_data.file_type,
            dashboard_type=dashboard_data.dashboard_data.dashboard_type,
            dashboard_data=dashboard_data.dashboard_data.model_dump(),
            extracted_text=dashboard_data.extracted_text[:50000],  # Store first 50k chars
            file_schema=dashboard_data.file_schema,
            is_public=False,
        )
        db.add(dashboard)
        await db.commit()
        await db.refresh(dashboard)

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
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to save dashboard: {str(e)}")


@router.get("", response_model=list[DashboardListResponse])
async def list_dashboards(
    skip: int = Query(0),
    limit: int = Query(10),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List user's dashboards"""
    result = await db.execute(
        select(Dashboard)
        .where(Dashboard.user_id == user_id)
        .order_by(desc(Dashboard.created_at))
        .offset(skip)
        .limit(limit)
    )
    dashboards = result.scalars().all()

    return [
        DashboardListResponse(
            id=d.id,
            title=d.title,
            file_name=d.file_name,
            file_type=d.file_type,
            dashboard_type=d.dashboard_type,
            is_public=d.is_public,
            created_at=d.created_at.isoformat(),
            updated_at=d.updated_at.isoformat(),
        )
        for d in dashboards
    ]


@router.get("/{dashboard_id}", response_model=DashboardResponse)
async def get_dashboard(
    dashboard_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific dashboard"""
    result = await db.execute(
        select(Dashboard).where(
            (Dashboard.id == dashboard_id) & (Dashboard.user_id == user_id)
        )
    )
    dashboard = result.scalars().first()

    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

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


@router.patch("/{dashboard_id}", response_model=DashboardResponse)
async def update_dashboard(
    dashboard_id: str,
    update_data: DashboardUpdate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update dashboard title or content"""
    result = await db.execute(
        select(Dashboard).where(
            (Dashboard.id == dashboard_id) & (Dashboard.user_id == user_id)
        )
    )
    dashboard = result.scalars().first()

    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    if update_data.title:
        dashboard.title = update_data.title
    if update_data.dashboard_data:
        dashboard.dashboard_data = update_data.dashboard_data.model_dump()
        dashboard.dashboard_type = update_data.dashboard_data.dashboard_type

    dashboard.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(dashboard)

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


@router.delete("/{dashboard_id}")
async def delete_dashboard(
    dashboard_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a dashboard"""
    result = await db.execute(
        select(Dashboard).where(
            (Dashboard.id == dashboard_id) & (Dashboard.user_id == user_id)
        )
    )
    dashboard = result.scalars().first()

    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    await db.delete(dashboard)
    await db.commit()

    return {"status": "deleted"}


@router.get("/{dashboard_id}/export/pptx")
async def export_pptx(
    dashboard_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export dashboard as PowerPoint presentation"""
    result = await db.execute(
        select(Dashboard).where(
            (Dashboard.id == dashboard_id) & (Dashboard.user_id == user_id)
        )
    )
    dashboard = result.scalars().first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    try:
        pptx_bytes = generate_pptx(dashboard.dashboard_data)
        filename = f"{dashboard.title.replace(' ', '_')}.pptx"
        return Response(
            content=pptx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.post("/{dashboard_id}/brief")
async def get_executive_brief(
    dashboard_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate an executive brief for a dashboard using LLM"""
    result = await db.execute(
        select(Dashboard).where(
            (Dashboard.id == dashboard_id) & (Dashboard.user_id == user_id)
        )
    )
    dashboard = result.scalars().first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    try:
        brief = await generate_executive_brief(dashboard.dashboard_data, settings)
        return brief
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Brief generation failed: {str(e)}")


@router.post("/{dashboard_id}/share", response_model=ShareLinkResponse)
async def create_share_link(
    dashboard_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a public share link for dashboard"""
    result = await db.execute(
        select(Dashboard).where(
            (Dashboard.id == dashboard_id) & (Dashboard.user_id == user_id)
        )
    )
    dashboard = result.scalars().first()

    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    # Generate unique share token
    if not dashboard.share_token:
        dashboard.share_token = secrets.token_urlsafe(16)

    dashboard.is_public = True
    dashboard.updated_at = datetime.utcnow()
    await db.commit()

    return ShareLinkResponse(
        share_token=dashboard.share_token,
        share_url=f"/shared/{dashboard.share_token}",
        is_public=True,
    )


@router.post("/{dashboard_id}/unshare")
async def revoke_share_link(
    dashboard_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke public share link"""
    result = await db.execute(
        select(Dashboard).where(
            (Dashboard.id == dashboard_id) & (Dashboard.user_id == user_id)
        )
    )
    dashboard = result.scalars().first()

    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    dashboard.is_public = False
    dashboard.share_token = None
    dashboard.updated_at = datetime.utcnow()
    await db.commit()

    return {"status": "unshared"}
