from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, JSON, Integer
from sqlalchemy.orm import relationship
from datetime import datetime
import json
from app.database import Base


class Dashboard(Base):
    __tablename__ = "dashboards"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    file_name = Column(String(255))
    file_type = Column(String(50))  # csv, xlsx, pdf, docx, json
    dashboard_type = Column(String(50))  # pl_statement, bcg_matrix, swot, kpi_summary, market_analysis, general

    # Dashboard content - stored as JSON
    dashboard_data = Column(JSON, nullable=False)

    # File metadata
    extracted_text = Column(String(50000))  # First 50k chars of extracted text
    file_schema = Column(JSON)
    parquet_path = Column(String(500))  # path to parquet snapshot; used by chat sandbox (Track B)

    # Sharing
    is_public = Column(Boolean, default=False)
    share_token = Column(String(100), unique=True, index=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="dashboards")
    shares = relationship("DashboardShare", back_populates="dashboard", cascade="all, delete-orphan")


class DashboardShare(Base):
    __tablename__ = "dashboard_shares"

    id = Column(String(36), primary_key=True)
    dashboard_id = Column(String(36), ForeignKey("dashboards.id"), nullable=False, index=True)

    # Share settings
    share_token = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255))  # Optional password protection
    expires_at = Column(DateTime)  # Optional expiration

    # Access tracking
    is_active = Column(Boolean, default=True)
    view_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    dashboard = relationship("Dashboard", back_populates="shares")
