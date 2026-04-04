import json
import logging
from typing import Dict, Any
from openai import OpenAI
from app.services.analyzers.base_analyzer import BaseAnalyzer
from app.schemas.dashboard import DashboardSchema

logger = logging.getLogger(__name__)


class OllamaAnalyzer(BaseAnalyzer):
    """Ollama analyzer for local free LLM models (OpenAI-compatible API)"""

    def __init__(self, base_url: str = "http://localhost:11434/v1"):
        super().__init__()
        self.client = OpenAI(
            api_key="ollama",  # Ollama doesn't require a real API key
            base_url=base_url,
        )
        self.model = "mistral"  # Default to mistral, can be changed

    async def analyze(
        self, extracted_text: str, file_schema: Dict[str, Any]
    ) -> DashboardSchema:
        """Generate dashboard using Ollama with function_calling"""

        # Truncate very long texts
        if len(extracted_text) > 8000:
            extracted_text = extracted_text[:8000] + "\n...[truncated]"

        # Note: Ollama's function calling support varies by model.
        # We'll try to use function calling, but fall back to JSON mode if needed
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
                "content": f"""Analyze the following extracted data and generate a business dashboard. Respond with ONLY valid JSON.

File Schema:
{json.dumps(file_schema, indent=2)}

Extracted Data:
{extracted_text}

Generate JSON with these exact keys:
- dashboard_type: one of [pl_statement, bcg_matrix, swot, kpi_summary, market_analysis, general]
- title: string
- executive_summary: string (2-3 sentences)
- kpis: array of objects with label, value, trend (up/down/flat), delta
- charts: array of objects with chart_type, title, data (array of objects), x_key, y_keys
- insights: array of strings
- recommendations: array of strings""",
            }
        ]

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=tools,
                tool_choice={"type": "function", "function": {"name": "generate_dashboard"}},
                temperature=0.7,
            )

            # Try to extract function call first
            dashboard_json = None
            if response.choices[0].message.tool_calls:
                for tool_call in response.choices[0].message.tool_calls:
                    if tool_call.function.name == "generate_dashboard":
                        dashboard_json = json.loads(tool_call.function.arguments)
                        break

            # If function calling didn't work, try to parse JSON from response
            if not dashboard_json:
                content = response.choices[0].message.content
                # Try to extract JSON from the response
                start = content.find("{")
                end = content.rfind("}") + 1
                if start >= 0 and end > start:
                    dashboard_json = json.loads(content[start:end])

            if not dashboard_json:
                raise ValueError("Ollama did not return valid dashboard JSON")

            # Validate against schema
            dashboard = DashboardSchema(**dashboard_json)
            return dashboard

        except Exception as e:
            logger.error(f"Ollama analysis failed: {str(e)}")
            raise
