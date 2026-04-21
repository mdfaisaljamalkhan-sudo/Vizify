import json
import logging
import os
from typing import Dict, Any
from anthropic import Anthropic
from app.services.analyzers.base_analyzer import BaseAnalyzer
from app.schemas.dashboard import DashboardSchema

logger = logging.getLogger(__name__)


class ClaudeAnalyzer(BaseAnalyzer):
    """Claude API analyzer using tool_use for structured JSON output"""

    def __init__(self, api_key: str, model: str | None = None):
        super().__init__()
        self.client = Anthropic(api_key=api_key)
        self.model = model or os.environ.get(
            "ANTHROPIC_MODEL_ANALYZE", "claude-haiku-4-5-20251001"
        )

    async def analyze(
        self, extracted_text: str, file_schema: Dict[str, Any]
    ) -> DashboardSchema:
        """Generate dashboard using Claude with tool_use"""

        # Truncate very long texts
        if len(extracted_text) > 8000:
            extracted_text = extracted_text[:8000] + "\n...[truncated]"

        dashboard_tool = {
            "name": "generate_dashboard",
            "description": "Generate a structured business dashboard from extracted data",
            "input_schema": {
                "type": "object",
                "properties": {
                    "dashboard_type": {
                        "type": "string",
                        "enum": [
                            "pl_statement",
                            "bcg_matrix",
                            "swot",
                            "kpi_summary",
                            "market_analysis",
                            "general",
                        ],
                        "description": "Type of dashboard to generate",
                    },
                    "title": {
                        "type": "string",
                        "description": "Dashboard title",
                    },
                    "executive_summary": {
                        "type": "string",
                        "description": "2-3 sentence executive summary",
                    },
                    "kpis": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": {"type": "string"},
                                "value": {"type": "string"},
                                "trend": {
                                    "type": "string",
                                    "enum": ["up", "down", "flat"],
                                },
                                "delta": {"type": "string"},
                                "source_code": {
                                    "type": "string",
                                    "description": "Short pandas expression showing how this KPI was derived, e.g. df['Revenue'].sum() or df['Profit'].mean()",
                                },
                            },
                            "required": ["label", "value", "trend", "delta"],
                        },
                        "description": "Key performance indicators",
                    },
                    "charts": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "chart_type": {
                                    "type": "string",
                                    "enum": [
                                        "bar",
                                        "line",
                                        "pie",
                                        "scatter",
                                        "waterfall",
                                        "quadrant",
                                    ],
                                },
                                "title": {"type": "string"},
                                "data": {
                                    "type": "array",
                                    "items": {"type": "object"},
                                },
                                "x_key": {"type": "string"},
                                "y_keys": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                                "source_code": {
                                    "type": "string",
                                    "description": "Short pandas expression used to prepare this chart's data, e.g. df.groupby('Quarter')['Revenue'].sum()",
                                },
                            },
                            "required": [
                                "chart_type",
                                "title",
                                "data",
                                "x_key",
                                "y_keys",
                            ],
                        },
                        "description": "Charts to display",
                    },
                    "insights": {
                        "type": "array",
                        "minItems": 3,
                        "items": {"type": "string"},
                        "description": "Key insights from the data",
                    },
                    "recommendations": {
                        "type": "array",
                        "minItems": 3,
                        "items": {"type": "string"},
                        "description": "Actionable recommendations",
                    },
                },
                "required": [
                    "dashboard_type",
                    "title",
                    "executive_summary",
                    "kpis",
                    "charts",
                    "insights",
                    "recommendations",
                ],
            },
        }

        messages = [
            {
                "role": "user",
                "content": f"""You are a senior analyst briefing the CEO. Analyze this data and generate a crisp executive dashboard.

File Schema:
{json.dumps(file_schema, indent=2)}

Extracted Data:
{extracted_text}

STRICT FORMAT RULES (C-Suite audience):
- KPIs: 4–6 metrics with exact values and trend direction from the data
- Charts: 2–4 charts (bar/line/pie/scatter/waterfall/quadrant) that best visualise the data
- insights: EXACTLY 4 items. Each is ONE sentence, max 20 words, leading with a number or % from the data. Example: "Revenue grew 23% QoQ, reaching $4.2M — highest in 3 quarters."
- recommendations: EXACTLY 4 items. Each is ONE action sentence starting with a verb, max 20 words. Example: "Increase marketing spend 15% in Q3 to capitalise on peak demand cycle."
- executive_summary: 2 sentences max, numbers-first, no fluff""",
            }
        ]

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=2500,  # raised slightly to avoid truncation of insights/recommendations
                tools=[dashboard_tool],
                tool_choice={"type": "tool", "name": "generate_dashboard"},
                messages=messages,
            )

            # Extract tool use block
            dashboard_json = None
            for block in response.content:
                if block.type == "tool_use":
                    dashboard_json = block.input
                    break

            if not dashboard_json:
                raise ValueError("Claude did not return tool_use response")

            # Validate against schema
            dashboard = DashboardSchema(**dashboard_json)
            return dashboard

        except Exception as e:
            logger.error(f"Claude analysis failed: {str(e)}")
            raise
