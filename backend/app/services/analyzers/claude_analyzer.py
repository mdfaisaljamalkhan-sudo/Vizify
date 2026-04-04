import json
import logging
from typing import Dict, Any
from anthropic import Anthropic
from app.services.analyzers.base_analyzer import BaseAnalyzer
from app.schemas.dashboard import DashboardSchema

logger = logging.getLogger(__name__)


class ClaudeAnalyzer(BaseAnalyzer):
    """Claude API analyzer using tool_use for structured JSON output"""

    def __init__(self, api_key: str):
        super().__init__()
        self.client = Anthropic(api_key=api_key)
        self.model = "claude-opus-4-6"

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
                        "items": {"type": "string"},
                        "description": "Key insights from the data",
                    },
                    "recommendations": {
                        "type": "array",
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
                "content": f"""Analyze the following extracted data and generate a business dashboard.

File Schema:
{json.dumps(file_schema, indent=2)}

Extracted Data:
{extracted_text}

Generate an appropriate dashboard with KPIs, charts, insights, and recommendations. Be specific with data values and trends.""",
            }
        ]

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=2048,
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
