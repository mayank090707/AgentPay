from datetime import datetime
from pydantic import BaseModel


class ReceiptResponse(BaseModel):
    receipt_id: str
    request_id: str
    quote_id: str
    tx_hash: str
    service_type: str
    amount: float
    currency: str
    payer_address: str
    provider_address: str
    content_hash: str
    delivered_at: datetime
    signature: str
