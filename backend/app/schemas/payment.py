from datetime import datetime
from pydantic import BaseModel, Field


class PaymentVerifyRequest(BaseModel):
    quote_id: str = Field(..., description="ID of the quote issued during HTTP 402 challenge")
    tx_hash: str = Field(..., description="Transaction hash of payment on-chain or mock")
    payer_address: str = Field(..., description="Wallet address of payer")


class PaymentVerifyResponse(BaseModel):
    status: str
    quote_id: str
    request_id: str
    tx_hash: str
    amount: float
    currency: str
    verified_at: datetime
