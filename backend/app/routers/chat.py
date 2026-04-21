import asyncio
import logging
from fastapi import APIRouter, HTTPException, Depends
from anthropic import Anthropic
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.chat_edit import ChatEditRequest, ChatEditResponse, UndoRequest
from app.database import settings, get_db
from app.services.chat_editor_service import ChatEditorService
from app.dependencies import get_current_user
from app.models.dashboard_version import DashboardVersion

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """
    Chat with Claude about the uploaded data.
    Takes the user's question and context from the dashboard to provide data-driven answers.
    """
    try:
        client = Anthropic(api_key=settings.anthropic_api_key)

        # Truncate extracted text to avoid token limits
        extracted_text = request.extracted_text[:8000]

        # Format the context for Claude
        context_str = f"Dashboard Type: {request.dashboard_context.get('dashboard_type', 'N/A')}\n"
        context_str += f"Title: {request.dashboard_context.get('title', 'N/A')}\n"
        context_str += f"Executive Summary: {request.dashboard_context.get('executive_summary', 'N/A')}"

        # Build the user message with full context
        user_message = f"""I have a business dashboard with the following context:

{context_str}

Here is the raw data from the uploaded file:
{extracted_text}

Now, please answer this question: {request.message}

Be specific with numbers, percentages, and data from the provided information."""

        response = await asyncio.to_thread(
            client.messages.create,
            model=settings.anthropic_model_chat,
            max_tokens=1024,
            system="You are a data analyst assistant. Answer questions about business data with specificity and reference to the actual data provided. Provide actionable insights and be concise.",
            messages=[{"role": "user", "content": user_message}],
        )

        return ChatResponse(response=response.content[0].text)

    except Exception as e:
        logger.error(f"Chat failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@router.post("/chat/edit", response_model=ChatEditResponse)
async def edit_dashboard(
    request: ChatEditRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatEditResponse:
    """
    Edit a dashboard using natural language via LLM.
    Generates Python code, executes safely in a sandbox, and saves version history.
    """
    service = ChatEditorService()
    result = await service.process_edit_request(
        message=request.message,
        dashboard_id=request.dashboard_id,
        user_id=user_id,
        extracted_text=request.extracted_text,
        db=db,
    )
    return result


@router.get("/chat/edit/history/{dashboard_id}")
async def get_edit_history(
    dashboard_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get version history for a dashboard."""
    service = ChatEditorService()
    history = await service.get_edit_history(
        dashboard_id=dashboard_id,
        user_id=user_id,
        db=db,
    )
    return {"history": history}


@router.post("/chat/edit/undo", response_model=ChatEditResponse)
async def undo_edit(
    request: UndoRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatEditResponse:
    """Revert a dashboard to a previous version."""
    service = ChatEditorService()

    # If no target version specified, undo last change
    if request.target_version is None:
        stmt = (
            select(DashboardVersion)
            .where(DashboardVersion.dashboard_id == request.dashboard_id)
            .order_by(DashboardVersion.version_number.desc())
        )
        result = await db.execute(stmt)
        latest = result.scalars().first()
        if not latest:
            raise HTTPException(status_code=404, detail="No versions to undo to")
        # Undo to the previous version
        request.target_version = max(1, latest.version_number - 1)

    result = await service.undo_to_version(
        dashboard_id=request.dashboard_id,
        user_id=user_id,
        target_version=request.target_version,
        db=db,
    )
    return result
