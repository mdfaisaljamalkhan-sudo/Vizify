import logging
from fastapi import APIRouter, HTTPException
from anthropic import Anthropic
from app.schemas.chat import ChatRequest, ChatResponse
from app.database import settings

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

        response = client.messages.create(
            model=settings.anthropic_model_chat,
            max_tokens=1024,
            system="You are a data analyst assistant. Answer questions about business data with specificity and reference to the actual data provided. Provide actionable insights and be concise.",
            messages=[
                {"role": "user", "content": user_message}
            ],
        )

        return ChatResponse(response=response.content[0].text)

    except Exception as e:
        logger.error(f"Chat failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")
