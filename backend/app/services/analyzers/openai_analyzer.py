import json
import logging
from typing import Dict, Any
from openai import OpenAI
from app.services.analyzers.base_analyzer import BaseAnalyzer
from app.schemas.dashboard import DashboardSchema

logger = logging.getLogger(__name__)


class OpenAIAnalyzer(BaseAnalyzer):
    """OpenAI analyzer using function_calling for structured JSON output"""

    def __init__(self, api_key: str):
        super().__init__()
        self.client = OpenAI(api_key=api_key)
        self.model = "gpt-4o-mini"

    async def analyze(
        self, extracted_text: str, file_schema: Dict[str, Any]
    ) -> DashboardSchema:
        """Generate dashboard using OpenAI with function_calling"""

        # Truncate very long texts
        if len(extracted_text) > 8000:
            extracted_text = extracted_text[:8000] + "\n...[truncated]"

        tools = [
            {
                "type": "function",
                "function": {
                    "name": "generate_dashboard",
                    "description": "Generate a structured business dashboard from extracted data",
                    "parameters": {
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
                },
            }
        ]

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
- Charts: 2–4 charts that best visualise the data
- insights: EXACTLY 4 items. Each is ONE sentence, max 20 words, leading with a number or % from the data.
- recommendations: EXACTLY 4 items. Each is ONE action sentence starting with a verb, max 20 words.
- executive_summary: 2 sentences max, numbers-first, no fluff""",
            }
        ]

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=tools,
                tool_choice={"type": "function", "function": {"name": "generate_dashboard"}},
            )

            # Extract function call
            dashboard_json = None
            for tool_call in response.choices[0].message.tool_calls:
                if tool_call.function.name == "generate_dashboard":
                    dashboard_json = json.loads(tool_call.function.arguments)
                    break

            if not dashboard_json:
                raise ValueError("OpenAI did not return function call response")

            # Validate against schema
            dashboard = DashboardSchema(**dashboard_json)
            return dashboard

        except Exception as e:
            logger.error(f"OpenAI analysis failed: {str(e)}")
            raise
