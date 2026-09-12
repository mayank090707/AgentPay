import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime
from backend.app.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    quote_id = Column(String(36), index=True, nullable=False, unique=True)
    request_id = Column(String(36), index=True, nullable=False)
    tx_hash = Column(String(100), index=True, nullable=False, unique=True)
    payer_address = Column(String(100), nullable=False)
    amount = Column(Float, nullable=False)
    verified_at = Column(DateTime, default=datetime.utcnow, nullable=False)
