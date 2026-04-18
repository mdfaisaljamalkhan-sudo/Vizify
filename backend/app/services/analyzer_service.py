import logging
from typing import Optional, Dict, Any
from io import StringIO
import pandas as pd

from app.services.analyzers.base_analyzer import BaseAnalyzer
from app.services.analyzers.claude_analyzer import ClaudeAnalyzer
from app.services.analyzers.openai_analyzer import OpenAIAnalyzer
from app.services.analyzers.deepseek_analyzer import DeepseekAnalyzer
from app.services.analyzers.ollama_analyzer import OllamaAnalyzer
from app.services.analyzers.groq_analyzer import GroqAnalyzer
from app.services.analyzers.gemini_analyzer import GeminiAnalyzer
from app.schemas.dashboard import DashboardSchema
from app.services.period_analyzer import PeriodAnalyzer

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
        groq_api_key: Optional[str] = None,
        gemini_api_key: Optional[str] = None,
    ) -> BaseAnalyzer:
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
            return OllamaAnalyzer(base_url=base_url)

        elif provider == "groq":
            if not groq_api_key:
                raise ValueError("GROQ_API_KEY not configured")
            if provider not in AnalyzerService._instances:
                AnalyzerService._instances[provider] = GroqAnalyzer(api_key=groq_api_key)
            return AnalyzerService._instances[provider]

        elif provider == "gemini":
            if not gemini_api_key:
                raise ValueError("GEMINI_API_KEY not configured")
            if provider not in AnalyzerService._instances:
                AnalyzerService._instances[provider] = GeminiAnalyzer(api_key=gemini_api_key)
            return AnalyzerService._instances[provider]

        else:
            raise ValueError(
                f"Unsupported provider: {provider}. "
                "Supported: claude, openai, deepseek, ollama, groq, gemini"
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
        groq_api_key: Optional[str] = None,
        gemini_api_key: Optional[str] = None,
    ) -> DashboardSchema:
        analyzer = AnalyzerService.get_analyzer(
            provider=provider,
            anthropic_api_key=anthropic_api_key,
            openai_api_key=openai_api_key,
            deepseek_api_key=deepseek_api_key,
            ollama_base_url=ollama_base_url,
            groq_api_key=groq_api_key,
            gemini_api_key=gemini_api_key,
        )
        return await analyzer.analyze(extracted_text, file_schema)

    @staticmethod
    async def analyze_with_fallback(
        chain: list[str],
        extracted_text: str,
        file_schema: Dict[str, Any],
        **key_kwargs,
    ) -> tuple[DashboardSchema, str]:
        """
        Try providers in order until one succeeds.
        Returns (dashboard, provider_used).
        Raises the last exception if all fail.
        """
        last_exc: Exception = RuntimeError("No providers in fallback chain")
        for provider in chain:
            try:
                dashboard = await AnalyzerService.analyze(
                    provider=provider,
                    extracted_text=extracted_text,
                    file_schema=file_schema,
                    **key_kwargs,
                )
                if provider != chain[0]:
                    logger.warning("Fell back to provider '%s'", provider)
                return dashboard, provider
            except Exception as exc:
                logger.warning("Provider '%s' failed: %s", provider, exc)
                last_exc = exc
        raise last_exc

    @staticmethod
    def clear_cache():
        """Clear cached analyzer instances (useful for testing)"""
        AnalyzerService._instances.clear()

    @staticmethod
    async def enrich_with_period_analytics(
        dashboard: DashboardSchema, extracted_text: str
    ) -> DashboardSchema:
        """
        Enrich a dashboard with period-over-period metrics by:
        1. Detecting date columns in extracted_text
        2. Computing MoM/QoQ/YoY deltas for numeric columns
        3. Updating KPI trend/delta fields with period metrics
        4. Generating narrative for each KPI
        """
        try:
            # Parse extracted_text as CSV to detect dates and numeric columns
            df = pd.read_csv(StringIO(extracted_text), on_error='ignore')
        except Exception as e:
            logger.warning(f"Failed to parse extracted_text for period analysis: {e}")
            return dashboard

        period_analyzer = PeriodAnalyzer()

        # Detect date column
        date_col = period_analyzer.detect_date_column(df)
        if not date_col:
            logger.debug("No date column detected for period analysis")
            return dashboard

        # Compute period metrics for all numeric columns
        numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
        metrics_by_col = period_analyzer.compute_period_metrics(df, date_col, numeric_cols)

        if not metrics_by_col:
            return dashboard

        # Update KPIs with period metrics
        if dashboard.kpis:
            enriched_kpis = []
            for kpi in dashboard.kpis:
                # Try to match KPI label to a column in metrics
                # Simple heuristic: if column name is a substring of KPI label, use those metrics
                matching_metrics = None
                for col, metrics in metrics_by_col.items():
                    if col.lower() in kpi.label.lower() or kpi.label.lower() in col.lower():
                        matching_metrics = metrics
                        break

                if matching_metrics:
                    kpi_dict = kpi.dict() if hasattr(kpi, 'dict') else kpi.__dict__
                    enriched_kpi = period_analyzer.update_kpi_with_periods(
                        kpi_dict, matching_metrics
                    )
                    # Generate narrative
                    narrative = await period_analyzer.generate_kpi_narratives(
                        kpi.label, kpi.value, matching_metrics
                    )
                    if narrative:
                        enriched_kpi['narrative'] = narrative

                    enriched_kpis.append(enriched_kpi)
                else:
                    enriched_kpis.append(kpi.dict() if hasattr(kpi, 'dict') else kpi.__dict__)

            # Update dashboard with enriched KPIs
            dashboard_dict = dashboard.dict() if hasattr(dashboard, 'dict') else dashboard.__dict__
            dashboard_dict['kpis'] = enriched_kpis
            return DashboardSchema(**dashboard_dict)

        return dashboard
