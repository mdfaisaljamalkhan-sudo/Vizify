import logging
from typing import Optional, Dict, Any
from app.services.analyzers.base_analyzer import BaseAnalyzer
from app.services.analyzers.claude_analyzer import ClaudeAnalyzer
from app.services.analyzers.openai_analyzer import OpenAIAnalyzer
from app.services.analyzers.deepseek_analyzer import DeepseekAnalyzer
from app.services.analyzers.ollama_analyzer import OllamaAnalyzer
from app.schemas.dashboard import DashboardSchema

logger = logging.getLogger(__name__)


class AnalyzerService:
    """Factory service for LLM-based dashboard analyzers"""

    _instances: Dict[str, BaseAnalyzer] = {}

    @staticmethod
    def get_analyzer(
        provider: str,
        anthropic_api_key: Optional[str] = None,
        openai_api_key: Optional[str] = None,
        deepseek_api_key: Optional[str] = None,
        ollama_base_url: Optional[str] = None,
    ) -> BaseAnalyzer:
        """
        Get analyzer instance for the specified provider

        Args:
            provider: One of "claude", "openai", "deepseek", "ollama"
            anthropic_api_key: Claude API key
            openai_api_key: OpenAI API key
            deepseek_api_key: Deepseek API key
            ollama_base_url: Ollama base URL (default: http://localhost:11434/v1)

        Returns:
            BaseAnalyzer instance
        """
        if provider == "claude":
            if not anthropic_api_key:
                raise ValueError("ANTHROPIC_API_KEY not configured")
            if provider not in AnalyzerService._instances:
                AnalyzerService._instances[provider] = ClaudeAnalyzer(
                    api_key=anthropic_api_key
                )
            return AnalyzerService._instances[provider]

        elif provider == "openai":
            if not openai_api_key:
                raise ValueError("OPENAI_API_KEY not configured")
            if provider not in AnalyzerService._instances:
                AnalyzerService._instances[provider] = OpenAIAnalyzer(
                    api_key=openai_api_key
                )
            return AnalyzerService._instances[provider]

        elif provider == "deepseek":
            if not deepseek_api_key:
                raise ValueError("DEEPSEEK_API_KEY not configured")
            if provider not in AnalyzerService._instances:
                AnalyzerService._instances[provider] = DeepseekAnalyzer(
                    api_key=deepseek_api_key
                )
            return AnalyzerService._instances[provider]

        elif provider == "ollama":
            base_url = ollama_base_url or "http://localhost:11434/v1"
            # Create new instance each time to allow base_url override
            return OllamaAnalyzer(base_url=base_url)

        else:
            raise ValueError(
                f"Unsupported provider: {provider}. Supported: claude, openai, deepseek, ollama"
            )

    @staticmethod
    async def analyze(
        provider: str,
        extracted_text: str,
        file_schema: Dict[str, Any],
        anthropic_api_key: Optional[str] = None,
        openai_api_key: Optional[str] = None,
        deepseek_api_key: Optional[str] = None,
        ollama_base_url: Optional[str] = None,
    ) -> DashboardSchema:
        """
        Analyze extracted data and generate dashboard

        Args:
            provider: One of "claude", "openai", "deepseek", "ollama"
            extracted_text: Raw text extracted from file
            file_schema: Metadata about the file
            anthropic_api_key: Claude API key
            openai_api_key: OpenAI API key
            deepseek_api_key: Deepseek API key
            ollama_base_url: Ollama base URL

        Returns:
            DashboardSchema: Structured dashboard definition
        """
        analyzer = AnalyzerService.get_analyzer(
            provider=provider,
            anthropic_api_key=anthropic_api_key,
            openai_api_key=openai_api_key,
            deepseek_api_key=deepseek_api_key,
            ollama_base_url=ollama_base_url,
        )

        return await analyzer.analyze(extracted_text, file_schema)

    @staticmethod
    def clear_cache():
        """Clear cached analyzer instances (useful for testing)"""
        AnalyzerService._instances.clear()
