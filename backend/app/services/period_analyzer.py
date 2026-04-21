import asyncio
import json
import logging
import re
from typing import Optional, List
import pandas as pd
import numpy as np
from anthropic import Anthropic
from app.database import settings

logger = logging.getLogger(__name__)


class PeriodAnalyzer:
    """Detect date columns and compute period-over-period analytics."""

    def __init__(self):
        self.client = Anthropic(api_key=settings.anthropic_api_key)

    def detect_date_column(self, df: pd.DataFrame) -> Optional[str]:
        """
        Detect date/datetime column in dataframe.
        Returns column name if found, None otherwise.
        """
        if df.empty:
            return None

        # First, check for datetime dtype
        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                return col

        # Then check for object columns that look like dates
        for col in df.columns:
            if df[col].dtype == 'object':
                try:
                    # Try to parse first non-null value
                    sample = df[col].dropna().iloc[0] if len(df[col].dropna()) > 0 else None
                    if sample:
                        pd.to_datetime(sample)
                        # If successful, try to convert the column
                        parsed = pd.to_datetime(df[col], errors='coerce')
                        if parsed.notna().sum() > len(df) * 0.8:  # 80% successful parse rate
                            return col
                except (ValueError, TypeError):
                    continue

        return None

    def compute_period_metrics(
        self, df: pd.DataFrame, date_col: str, numeric_cols: Optional[list] = None
    ) -> dict:
        """
        Compute period-over-period metrics (MoM, QoQ, YoY) for numeric columns.
        Returns dict with metrics for each numeric column.
        """
        if date_col not in df.columns:
            return {}

        # Convert date column to datetime if not already
        df = df.copy()
        df[date_col] = pd.to_datetime(df[date_col], errors='coerce')

        # Identify numeric columns if not specified
        if numeric_cols is None:
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

        if not numeric_cols:
            return {}

        metrics = {}

        # Extract year-month and year-quarter for grouping
        df['_year_month'] = df[date_col].dt.to_period('M')
        df['_year_quarter'] = df[date_col].dt.to_period('Q')
        df['_year'] = df[date_col].dt.to_period('Y')

        # Compute monthly aggregates
        monthly_agg = df.groupby('_year_month')[numeric_cols].sum()
        quarterly_agg = df.groupby('_year_quarter')[numeric_cols].sum()
        yearly_agg = df.groupby('_year')[numeric_cols].sum()

        for col in numeric_cols:
            metrics[col] = {
                'mom_delta': None,
                'mom_pct': None,
                'qoq_delta': None,
                'qoq_pct': None,
                'yoy_delta': None,
                'yoy_pct': None,
            }

            # MoM (Month-over-Month)
            if len(monthly_agg) >= 2:
                current = monthly_agg[col].iloc[-1]
                previous = monthly_agg[col].iloc[-2]
                if previous != 0:
                    metrics[col]['mom_delta'] = float(current - previous)
                    metrics[col]['mom_pct'] = float(((current - previous) / abs(previous)) * 100)

            # QoQ (Quarter-over-Quarter)
            if len(quarterly_agg) >= 2:
                current = quarterly_agg[col].iloc[-1]
                previous = quarterly_agg[col].iloc[-2]
                if previous != 0:
                    metrics[col]['qoq_delta'] = float(current - previous)
                    metrics[col]['qoq_pct'] = float(((current - previous) / abs(previous)) * 100)

            # YoY (Year-over-Year)
            if len(yearly_agg) >= 2:
                current = yearly_agg[col].iloc[-1]
                previous = yearly_agg[col].iloc[-2]
                if previous != 0:
                    metrics[col]['yoy_delta'] = float(current - previous)
                    metrics[col]['yoy_pct'] = float(((current - previous) / abs(previous)) * 100)

        return metrics

    async def generate_kpi_narratives_batch(
        self, kpis: List[dict]
    ) -> dict[str, str]:
        """
        Generate one-line narratives for ALL KPIs in a SINGLE LLM call.
        Returns {kpi_label: narrative_string}.
        Previously this was N separate calls (one per KPI) — batching saves 40-60s.
        """
        if not kpis:
            return {}

        kpi_list = "\n".join(
            f"- {k['label']} (value={k['value']}, "
            f"MoM={k['metrics'].get('mom_pct','N/A')}%, "
            f"QoQ={k['metrics'].get('qoq_pct','N/A')}%, "
            f"YoY={k['metrics'].get('yoy_pct','N/A')}%)"
            for k in kpis
        )

        prompt = (
            "Generate ONE-LINE business narratives (max 12 words each) for these KPIs.\n"
            "Return ONLY a JSON object: {\"KPI Label\": \"narrative\", ...}\n\n"
            f"{kpi_list}"
        )

        try:
            response = await asyncio.to_thread(
                self.client.messages.create,
                model=settings.anthropic_model_analyze,
                max_tokens=300,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text.strip()
            match = re.search(r'\{[\s\S]*\}', text)
            if match:
                return json.loads(match.group())
        except Exception as e:
            logger.error(f"Batch narrative generation failed: {e}")

        return {}

    async def generate_kpi_narratives(
        self, kpi_name: str, current_value: str, metrics: dict
    ) -> str:
        """Single-KPI narrative kept for backward compatibility."""
        result = await self.generate_kpi_narratives_batch(
            [{"label": kpi_name, "value": current_value, "metrics": metrics}]
        )
        return result.get(kpi_name, "")

    def update_kpi_with_periods(self, kpi: dict, metrics: dict) -> dict:
        """
        Update a KPI object with period-over-period metrics.
        Infers trend direction and delta from the most recent available metric.
        """
        kpi = kpi.copy()

        # Prioritize most recent metric: QoQ > YoY > MoM
        for key in ['qoq_pct', 'yoy_pct', 'mom_pct']:
            if metrics.get(key) is not None:
                pct = metrics[key]
                # Update trend
                if pct > 5:  # 5% threshold to avoid noise
                    kpi['trend'] = 'up'
                elif pct < -5:
                    kpi['trend'] = 'down'
                else:
                    kpi['trend'] = 'flat'

                # Update delta
                kpi['delta'] = f"{abs(pct):.1f}%"
                break

        return kpi
