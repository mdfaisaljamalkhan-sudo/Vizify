from fastapi import APIRouter, HTTPException
from app.services.analyzer_service import AnalyzerService
from app.schemas.dashboard import AnalyzeRequest, AnalyzeResponse, DashboardSchema
from app.database import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["analyze"])

ALL_PROVIDERS = ["claude", "openai", "deepseek", "ollama", "groq", "gemini"]


def _key_kwargs() -> dict:
    return {
        "anthropic_api_key": settings.anthropic_api_key,
        "openai_api_key": settings.openai_api_key,
        "deepseek_api_key": settings.deepseek_api_key,
        "ollama_base_url": settings.ollama_base_url,
        "groq_api_key": settings.groq_api_key,
        "gemini_api_key": settings.gemini_api_key,
    }


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_data(request: AnalyzeRequest) -> AnalyzeResponse:
    """
    Analyze extracted file data using LLM and generate structured dashboard.
    When no provider is specified, runs the configured fallback chain
    (ANTHROPIC → GROQ → GEMINI) so analysis succeeds even if credits run out.
    """
    try:
        if request.provider:
            # Explicit provider — single attempt, no fallback
            if request.provider not in ALL_PROVIDERS:
                raise ValueError(
                    f"Invalid provider: {request.provider}. Must be one of: {', '.join(ALL_PROVIDERS)}"
                )
            dashboard = await AnalyzerService.analyze(
                provider=request.provider,
                extracted_text=request.extracted_text,
                file_schema=request.file_schema,
                **_key_kwargs(),
            )

            # Enrich with period analytics if dates are present
            dashboard = await AnalyzerService.enrich_with_period_analytics(
                dashboard, request.extracted_text
            )

            return AnalyzeResponse(success=True, dashboard=dashboard)

        # No provider specified — use fallback chain from settings
        chain = [p.strip() for p in settings.llm_fallback_chain.split(",") if p.strip()]
        dashboard, used = await AnalyzerService.analyze_with_fallback(
            chain=chain,
            extracted_text=request.extracted_text,
            file_schema=request.file_schema,
            **_key_kwargs(),
        )

        # Enrich with period analytics if dates are present
        dashboard = await AnalyzerService.enrich_with_period_analytics(
            dashboard, request.extracted_text
        )

        return AnalyzeResponse(success=True, dashboard=dashboard)

    except ValueError as e:
        logger.error(f"Analysis validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/analyze/providers")
async def get_available_providers():
    """List available analyzer providers and their configuration status."""
    providers = {
        "claude": {
            "enabled": bool(settings.anthropic_api_key),
            "description": "Anthropic Claude Haiku (ANTHROPIC_API_KEY)",
        },
        "openai": {
            "enabled": bool(settings.openai_api_key),
            "description": "OpenAI GPT-4o-mini (OPENAI_API_KEY)",
        },
        "deepseek": {
            "enabled": bool(settings.deepseek_api_key),
            "description": "Deepseek Chat (DEEPSEEK_API_KEY)",
        },
        "ollama": {
            "enabled": True,
            "description": f"Local Ollama ({settings.ollama_base_url})",
        },
        "groq": {
            "enabled": bool(settings.groq_api_key),
            "description": "Groq Llama 3.1 70B — free tier fallback (GROQ_API_KEY)",
        },
        "gemini": {
            "enabled": bool(settings.gemini_api_key),
            "description": "Google Gemini 1.5 Flash — free tier fallback (GEMINI_API_KEY)",
        },
    }

    return {
        "default_provider": settings.analyzer_provider,
        "fallback_chain": settings.llm_fallback_chain,
        "providers": providers,
    }
