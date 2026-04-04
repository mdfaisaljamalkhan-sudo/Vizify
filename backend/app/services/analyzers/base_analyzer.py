from abc import ABC, abstractmethod
from typing import Dict, Any
from app.schemas.dashboard import DashboardSchema


class BaseAnalyzer(ABC):
    """Abstract base class for LLM-based dashboard analyzers"""

    def __init__(self):
        pass

    @abstractmethod
    async def analyze(
        self, extracted_text: str, file_schema: Dict[str, Any]
    ) -> DashboardSchema:
        """
        Analyze extracted data and generate structured dashboard JSON

        Args:
            extracted_text: Raw text extracted from uploaded file
            file_schema: Metadata about the file (columns, dtypes, sample data, etc.)

        Returns:
            DashboardSchema: Structured dashboard definition
        """
        pass
