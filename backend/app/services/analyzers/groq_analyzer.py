import logging
from openai import OpenAI
from app.services.analyzers.openai_analyzer import OpenAIAnalyzer

logger = logging.getLogger(__name__)

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GROQ_DEFAULT_MODEL = "llama-3.1-70b-versatile"


class GroqAnalyzer(OpenAIAnalyzer):
    """Groq (Llama 3.1 70B) analyzer — OpenAI-compatible, generous free tier."""

    def __init__(self, api_key: str, model: str = GROQ_DEFAULT_MODEL):
        super().__init__(api_key=api_key)
        self.client = OpenAI(api_key=api_key, base_url=GROQ_BASE_URL)
        self.model = model
