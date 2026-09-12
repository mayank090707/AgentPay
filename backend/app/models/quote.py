import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Enum as SQLEnum
import enum
from backend.app.database import Base


class QuoteStatus(str, enum.Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    EXPIRED = "EXPIRED"


class Quote(Base):
    __tablename__ = "quotes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = Column(String(255), index=True, nullable=False)
    service_type = Column(String(50), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(20), default="USDC")
    provider_address = Column(String(100), nullable=False)
    status = Column(SQLEnum(QuoteStatus), default=QuoteStatus.PENDING, nullable=False)
    input_hash = Column(String(64), index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
