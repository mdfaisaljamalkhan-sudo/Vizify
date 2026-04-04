from fastapi import APIRouter, HTTPException
from app.services.analyzer_service import AnalyzerService
from app.schemas.dashboard import AnalyzeRequest, AnalyzeResponse, DashboardSchema
from app.database import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["analyze"])


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_data(request: AnalyzeRequest) -> AnalyzeResponse:
    """
    Analyze extracted file data using LLM and generate structured dashboard

    Request body:
    - extracted_text: Text extracted from the uploaded file
    - file_schema: Metadata about the file (columns, dtypes, sample data, etc.)
    - provider: (Optional) Override default analyzer provider

    Returns: Dashboard schema with KPIs, charts, insights, and recommendations
    """

    try:
        # Determine provider
        provider = request.provider or settings.analyzer_provider

        # Validate provider
        valid_providers = ["claude", "openai", "deepseek", "ollama"]
        if provider not in valid_providers:
            raise ValueError(
                f"Invalid provider: {provider}. Must be one of: {', '.join(valid_providers)}"
            )

        # Get API keys based on provider
        api_keys = {
            "anthropic_api_key": settings.anthropic_api_key,
            "openai_api_key": settings.openai_api_key,
            "deepseek_api_key": settings.deepseek_api_key,
            "ollama_base_url": settings.ollama_base_url,
        }

        # Analyze data
        dashboard = await AnalyzerService.analyze(
            provider=provider,
            extracted_text=request.extracted_text,
            file_schema=request.file_schema,
            **api_keys,
        )

        return AnalyzeResponse(success=True, dashboard=dashboard)

    except ValueError as e:
        logger.error(f"Analysis validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Analysis failed: {str(e)}"
        )


@router.get("/analyze/providers")
async def get_available_providers():
    """Get list of available analyzer providers and their configuration status"""
    providers = {
        "claude": {
            "enabled": bool(settings.anthropic_api_key),
            "description": "Anthropic Claude (requires ANTHROPIC_API_KEY)",
        },
        "openai": {
            "enabled": bool(settings.openai_api_key),
            "description": "OpenAI GPT models (requires OPENAI_API_KEY)",
        },
        "deepseek": {
            "enabled": bool(settings.deepseek_api_key),
            "description": "Deepseek models (requires DEEPSEEK_API_KEY)",
        },
        "ollama": {
            "enabled": True,
            "description": f"Local Ollama models (requires Ollama running at {settings.ollama_base_url})",
        },
    }

    return {
        "default_provider": settings.analyzer_provider,
        "providers": providers,
    }
