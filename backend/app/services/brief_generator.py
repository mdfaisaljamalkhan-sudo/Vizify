import json
import re
import logging

logger = logging.getLogger(__name__)

BRIEF_PROMPT = """You are a senior business analyst. Write a concise executive brief.

Dashboard: {title}
Summary: {summary}
KPIs: {kpis}
Insights: {insights}
Recommendations: {recommendations}

Return ONLY a JSON object with these keys:
{{
  "headline": "One powerful sentence summarizing the business situation",
  "situation": "2-3 sentences on current state",
  "top_insights": ["insight 1", "insight 2", "insight 3"],
  "top_risks": ["risk 1", "risk 2"],
  "actions": ["action 1", "action 2", "action 3"],
  "bottom_line": "One sentence call to action"
}}"""


async def generate_executive_brief(dashboard_data: dict, settings) -> dict:
    prompt = BRIEF_PROMPT.format(
        title=dashboard_data.get('title', 'Dashboard'),
        summary=dashboard_data.get('executive_summary', ''),
        kpis=[f"{k['label']}: {k['value']} ({k['delta']})" for k in dashboard_data.get('kpis', [])],
        insights=dashboard_data.get('insights', [])[:4],
        recommendations=dashboard_data.get('recommendations', [])[:4],
    )

    text = None

    # Try Anthropic
    if settings.anthropic_api_key:
        try:
            from anthropic import Anthropic
            client = Anthropic(api_key=settings.anthropic_api_key)
            resp = client.messages.create(
                model=settings.anthropic_model_chat,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            text = resp.content[0].text
        except Exception as e:
            logger.warning(f"Anthropic brief failed: {e}")

    # Try Groq
    if not text and settings.groq_api_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=settings.groq_api_key, base_url="https://api.groq.com/openai/v1")
            resp = client.chat.completions.create(
                model="llama-3.1-70b-versatile",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            text = resp.choices[0].message.content
        except Exception as e:
            logger.warning(f"Groq brief failed: {e}")

    # Try Gemini
    if not text and settings.gemini_api_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=settings.gemini_api_key, base_url="https://generativelanguage.googleapis.com/v1beta/openai/")
            resp = client.chat.completions.create(
                model="gemini-1.5-flash",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            text = resp.choices[0].message.content
        except Exception as e:
            logger.warning(f"Gemini brief failed: {e}")

    if not text:
        return _fallback_brief(dashboard_data)

    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            pass

    return _fallback_brief(dashboard_data)


def _fallback_brief(dashboard_data: dict) -> dict:
    return {
        "headline": dashboard_data.get('executive_summary', 'Executive Summary'),
        "situation": "",
        "top_insights": dashboard_data.get('insights', [])[:3],
        "top_risks": [],
        "actions": dashboard_data.get('recommendations', [])[:3],
        "bottom_line": "",
    }
