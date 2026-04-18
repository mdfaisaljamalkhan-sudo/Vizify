import logging
from openai import OpenAI
from app.services.analyzers.openai_analyzer import OpenAIAnalyzer

logger = logging.getLogger(__name__)

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
GEMINI_DEFAULT_MODEL = "gemini-1.5-flash"


class GeminiAnalyzer(OpenAIAnalyzer):
    """Google Gemini 1.5 Flash analyzer — OpenAI-compatible, 1M tokens/day free tier."""

    def __init__(self, api_key: str, model: str = GEMINI_DEFAULT_MODEL):
        super().__init__(api_key=api_key)
        self.client = OpenAI(api_key=api_key, base_url=GEMINI_BASE_URL)
        self.model = model
