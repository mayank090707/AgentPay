import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime
from backend.app.database import Base


class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = Column(String(36), index=True, nullable=False, unique=True)
    quote_id = Column(String(36), nullable=False)
    service_type = Column(String(50), nullable=False)
    input_hash = Column(String(64), nullable=False)
    content_hash = Column(String(64), nullable=False)  # SHA-256 of delivered output payload
    receipt_id = Column(String(36), nullable=False)
    receipt_signature = Column(String(128), nullable=False)
    delivered_at = Column(DateTime, default=datetime.utcnow, nullable=False)
