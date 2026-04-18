from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Integer, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class DashboardVersion(Base):
    __tablename__ = "dashboard_versions"

    id = Column(String(36), primary_key=True)
    dashboard_id = Column(String(36), ForeignKey("dashboards.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)

    # Version metadata
    version_number = Column(Integer, nullable=False)  # 1, 2, 3...
    change_description = Column(String(500))  # "Edited chart title", "Updated filters", etc.

    # Full snapshot of dashboard_data at this version
    dashboard_data = Column(JSON, nullable=False)

    # Change details for diffing (optional, for future UI)
    changes = Column(JSON)  # {"removed_elements": [...], "modified_elements": [...], "added_elements": [...]}

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Foreign key relationships
    dashboard = relationship("Dashboard")
    user = relationship("User")
