import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime
from backend.app.database import Base


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
