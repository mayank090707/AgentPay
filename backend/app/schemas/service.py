from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


# Service Pricing Schemas
class ServicePriceInfo(BaseModel):
    service_type: str
    unit: str
    price_per_unit: float
    currency: str = "USDC"
    description: str


class PricingCatalogResponse(BaseModel):
    provider_address: str
    services: Dict[str, ServicePriceInfo]


# Generic Service Request Schemas
class TranslationRequest(BaseModel):
    text: str = Field(..., description="Text to translate")
    source_lang: str = Field("auto", description="Source language ISO code")
    target_lang: str = Field("en", description="Target language ISO code")


class ComputeRequest(BaseModel):
    operation: str = Field(..., description="Computational operation type, e.g., 'matrix_multiply', 'prime_factorization', 'data_embedding'")
    params: Dict[str, Any] = Field(default_factory=dict, description="Parameters for the computation task")


class StorageRequest(BaseModel):
    key: str = Field(..., description="Unique key for the storage object")
    value: str = Field(..., description="Data payload to store")
    ttl_seconds: Optional[int] = Field(3600, description="Time to live in seconds")


# Generic Payment Proof Header / Schema
class PaymentProof(BaseModel):
    quote_id: str
    tx_hash: str
    payer_address: str


# HTTP 402 Quote Response Payload
class PaymentRequiredResponse(BaseModel):
    error: str = "Payment Required"
    message: str = "Payment quote generated. Please complete payment and retry with X-Payment-Proof header."
    request_id: str
    quote_id: str
    service_type: str
    amount: float
    currency: str
    pay_to_address: str
    expires_at: str


# Generic Service Output Response
class ServiceSuccessResponse(BaseModel):
    status: str = "success"
    request_id: str
    service_type: str
    data: Dict[str, Any]
    content_hash: str
    receipt: Dict[str, Any]
