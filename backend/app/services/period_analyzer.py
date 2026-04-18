import logging
from typing import Optional, Tuple
import pandas as pd
import numpy as np
from datetime import datetime
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

    async def generate_kpi_narratives(
        self, kpi_name: str, current_value: str, metrics: dict
    ) -> str:
        """
        Generate a one-line narrative for a KPI given its period-over-period metrics.
        Example: "Revenue up 12% QoQ, driven by strong Q4 demand"
        """
        if not any([metrics.get('mom_pct'), metrics.get('qoq_pct'), metrics.get('yoy_pct')]):
            return ""

        prompt = f"""Generate a single-line business narrative for this KPI metric.

KPI: {kpi_name}
Current Value: {current_value}
Metrics:
- Month-over-Month: {metrics.get('mom_pct', 'N/A')}% (delta: {metrics.get('mom_delta', 'N/A')})
- Quarter-over-Quarter: {metrics.get('qoq_pct', 'N/A')}% (delta: {metrics.get('qoq_delta', 'N/A')})
- Year-over-Year: {metrics.get('yoy_pct', 'N/A')}% (delta: {metrics.get('yoy_delta', 'N/A')})

Write ONE concise line (max 15 words) explaining the trend and key driver. Be specific with the metric that shows the biggest change.
Only the narrative line, nothing else."""

        try:
            response = self.client.messages.create(
                model=settings.anthropic_model_analyze,
                max_tokens=50,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.content[0].text.strip()
        except Exception as e:
            logger.error(f"Failed to generate narrative for {kpi_name}: {e}")
            return ""

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
