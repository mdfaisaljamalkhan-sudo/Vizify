from sqlalchemy import Column, String, DateTime, ForeignKey
from datetime import datetime
from app.database import Base


class DashboardComment(Base):
    __tablename__ = "dashboard_comments"

    id = Column(String(36), primary_key=True)
    dashboard_id = Column(String(36), ForeignKey("dashboards.id"), nullable=False, index=True)
    author_name = Column(String(100), nullable=False, default="Anonymous")
    text = Column(String(1000), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
