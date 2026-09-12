import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime
from backend.app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = Column(String(36), index=True, nullable=False)
    event_type = Column(String(50), index=True, nullable=False)  # QUOTE_CREATED, PAYMENT_VERIFIED, SERVICE_DELIVERED, AUDIT_VERIFIED
    details = Column(Text, nullable=False)  # JSON formatted details
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
