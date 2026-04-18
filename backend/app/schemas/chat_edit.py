from pydantic import BaseModel
from typing import Optional, Any


class ChatEditRequest(BaseModel):
    """User's edit request via chat."""
    message: str  # e.g., "Change the chart title to 'Revenue by Region'"
    dashboard_id: str
    extracted_text: str  # Raw data from original upload


class ChatEditResponse(BaseModel):
    """Response from chat-driven edit."""
    status: str  # "success", "error", "review_required"
    dashboard_data: Optional[dict] = None  # Updated dashboard if successful
    edit_description: Optional[str] = None  # What was changed, e.g., "Updated chart title"
    error: Optional[str] = None  # Error message if failed
    requires_review: Optional[bool] = False  # If LLM-generated code has side effects
    generated_code: Optional[str] = None  # The Python code that was executed (for transparency)
    execution_log: Optional[dict] = None  # Sandbox execution details


class EditHistoryResponse(BaseModel):
    """Version history of a dashboard."""
    version_number: int
    change_description: Optional[str]
    created_at: str
    created_by: str  # User who made the edit


class UndoRequest(BaseModel):
    """Request to revert to a previous version."""
    dashboard_id: str
    target_version: Optional[int] = None  # If None, undo last change
