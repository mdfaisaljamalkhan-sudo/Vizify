from pydantic import BaseModel
from typing import Optional, List, Literal


class KPIData(BaseModel):
    label: str
    value: str
    trend: Literal["up", "down", "flat"]
    delta: str  # e.g., "+15%", "-3%"


class ChartData(BaseModel):
    chart_type: Literal["bar", "line", "pie", "scatter", "waterfall", "quadrant"]
    title: str
    data: List[dict]
    x_key: str
    y_keys: List[str]


class DashboardSchema(BaseModel):
    dashboard_type: Literal[
        "pl_statement",
        "bcg_matrix",
        "swot",
        "kpi_summary",
        "market_analysis",
        "general",
    ]
    title: str
    executive_summary: str
    kpis: List[KPIData] = []
    charts: List[ChartData] = []
    insights: List[str] = []
    recommendations: List[str] = []


class AnalyzeRequest(BaseModel):
    extracted_text: str
    file_schema: dict
    provider: Optional[str] = None  # Optional override, defaults to .env setting


class AnalyzeResponse(BaseModel):
    success: bool
    dashboard: Optional[DashboardSchema] = None
    error: Optional[str] = None


# Dashboard Persistence Schemas
class DashboardCreate(BaseModel):
    title: str
    file_name: str
    file_type: str
    file_schema: dict
    extracted_text: str
    dashboard_data: DashboardSchema


class DashboardUpdate(BaseModel):
    title: Optional[str] = None
    dashboard_data: Optional[DashboardSchema] = None


class DashboardResponse(BaseModel):
    id: str
    title: str
    file_name: str
    file_type: str
    dashboard_type: str
    dashboard_data: DashboardSchema
    is_public: bool
    share_token: Optional[str]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class DashboardListResponse(BaseModel):
    id: str
    title: str
    file_name: str
    file_type: str
    dashboard_type: str
    is_public: bool
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class ShareLinkResponse(BaseModel):
    share_token: str
    share_url: str
    is_public: bool
