"""
Domain models and value objects for Person 2 (AI Agent + Payment).

Defines typed representations for:
- RequestId (32-byte hex domain value object)
- Lifecycle and status enums (AgentStage, PaymentStatus, DeliveryStatus)
- ServiceRequest, PaymentRequirement, PaymentResult
- DeliveryResult and ServiceReceipt (explicitly distinct semantics)
- AgentState (dashboard-facing aggregate state)

Strict architectural boundary: No Web3, HTTP, or LLM logic is implemented here.
"""

from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
import secrets
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from agent.src.exceptions import InvalidPaymentRequirementError, InvalidRequestError


class RequestId(str):
    """
    Domain value object representing a unique purchase request ID.

    Format constraint: '0x' followed by exactly 64 hexadecimal characters (32 bytes).
    Guarantees bytes32 compatibility with Solidity smart contracts without
    implementing blockchain encoding in Phase 1.
    """

    def __new__(cls, value: str) -> "RequestId":
        if not isinstance(value, str):
            raise InvalidRequestError(
                f"RequestId must be a string, got {type(value).__name__}",
                code="INVALID_REQUEST_ID",
            )
        normalized = value.strip().lower()
        if not cls.is_valid(normalized):
            raise InvalidRequestError(
                f"Invalid RequestId '{value}': must be '0x' followed by exactly 64 hexadecimal characters",
                code="INVALID_REQUEST_ID",
                request_id=value if len(value) <= 70 else f"{value[:70]}...",
            )
        return super().__new__(cls, normalized)

    @classmethod
    def is_valid(cls, value: Any) -> bool:
        """Check if a value matches the 0x + 64 hex characters format."""
        if not isinstance(value, str):
            return False
        v = value.strip().lower()
        if len(v) != 66 or not v.startswith("0x"):
            return False
        hex_part = v[2:]
        return all(c in "0123456789abcdef" for c in hex_part)

    @classmethod
    def generate(cls) -> "RequestId":
        """Generate a new cryptographically secure 32-byte hex RequestId."""
        return cls(f"0x{secrets.token_hex(32)}")

    @classmethod
    def __get_pydantic_core_schema__(cls, source_type: Any, handler: Any) -> Any:
        from pydantic_core import core_schema

        def validate_from_str(value: str) -> "RequestId":
            try:
                return cls(value)
            except (InvalidRequestError, ValueError) as e:
                raise ValueError(str(e)) from e

        return core_schema.no_info_after_validator_function(
            validate_from_str,
            core_schema.str_schema(),
            serialization=core_schema.to_string_ser_schema(),
        )


class AgentStage(str, Enum):
    """Lifecycle stages of the agent during a service purchase task."""

    IDLE = "IDLE"
    TASK_RECEIVED = "TASK_RECEIVED"
    PROVIDER_REQUESTED = "PROVIDER_REQUESTED"
    HTTP_402_RECEIVED = "HTTP_402_RECEIVED"
    CONTRACT_AUTHORIZING = "CONTRACT_AUTHORIZING"
    PAYMENT_APPROVED = "PAYMENT_APPROVED"
    BLOCKED_BY_SMART_CONTRACT = "BLOCKED_BY_SMART_CONTRACT"
    PAYMENT_SUBMITTED = "PAYMENT_SUBMITTED"
    PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED"
    DELIVERY_PENDING = "DELIVERY_PENDING"
    SERVICE_FULFILLED = "SERVICE_FULFILLED"
    DELIVERY_FAILED = "DELIVERY_FAILED"
    RECEIPT_RECORDED = "RECEIPT_RECORDED"
    RETRYING = "RETRYING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class PaymentStatus(str, Enum):
    """Payment transaction states."""

    PENDING = "PENDING"
    APPROVED = "APPROVED"
    SUBMITTED = "SUBMITTED"
    CONFIRMED = "CONFIRMED"
    BLOCKED = "BLOCKED"
    FAILED = "FAILED"


class DeliveryStatus(str, Enum):
    """Service delivery fulfillment states."""

    PENDING = "PENDING"
    FULFILLED = "FULFILLED"
    FAILED = "FAILED"


class ServiceRequest(BaseModel):
    """Domain model representing a service request initiated by the agent."""

    model_config = ConfigDict(extra="ignore")

    request_id: RequestId = Field(default_factory=RequestId.generate)
    service: str
    payload: dict[str, Any]
    parameters: Optional[dict[str, Any]] = None
    provider: Optional[str] = None

    @field_validator("service")
    @classmethod
    def validate_service_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise InvalidRequestError("Service name cannot be empty", code="EMPTY_SERVICE")
        return v.strip()


class PaymentRequirement(BaseModel):
    """
    Domain model representing payment terms demanded by a provider.
    Corresponds to information extracted from an HTTP 402 response.
    """

    model_config = ConfigDict(extra="ignore")

    request_id: RequestId
    amount: Decimal
    currency: str
    provider: str
    payment_address: str
    network: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None

    @field_validator("amount")
    @classmethod
    def validate_positive_amount(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise InvalidPaymentRequirementError(
                f"Payment amount must be greater than zero, got {v}",
                code="INVALID_AMOUNT",
            )
        return v

    @field_validator("currency", "provider", "payment_address")
    @classmethod
    def validate_non_empty(cls, v: str, info: Any) -> str:
        if not v or not v.strip():
            raise InvalidPaymentRequirementError(
                f"Field '{info.field_name}' cannot be empty",
                code="EMPTY_FIELD",
            )
        return v.strip()


class PaymentResult(BaseModel):
    """Domain model representing the outcome of a payment attempt."""

    model_config = ConfigDict(extra="ignore")

    request_id: RequestId
    amount: Decimal
    status: PaymentStatus
    transaction_hash: Optional[str] = None
    error_reason: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def validate_non_negative_amount(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError(f"Payment amount cannot be negative, got {v}")
        return v


class DeliveryResult(BaseModel):
    """
    Domain model representing the operational result of a service fulfillment attempt.
    Captures delivery status, raw response data, content hash, and errors if any.
    """

    model_config = ConfigDict(extra="ignore")

    request_id: RequestId
    delivery_status: DeliveryStatus
    result: Optional[Any] = None
    content_hash: Optional[str] = None
    error_reason: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ServiceReceipt(BaseModel):
    """
    Domain model representing the commercial and audit receipt for a completed service purchase.
    Binds the request, provider, payment reference, and content hash.
    Note: Treated as the domain representation of the commercial receipt without technical frozen immutability in Phase 1.
    """

    model_config = ConfigDict(extra="ignore")

    request_id: RequestId
    provider: str
    amount: Decimal
    currency: str
    payment_reference: str
    content_hash: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AgentState(BaseModel):
    """
    Dashboard-facing aggregate state model representing the agent's current task status.
    Directly aligns with Person 4 dashboard requirements.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    current_task: Optional[str] = None
    provider: Optional[str] = None
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
    request_id: Optional[RequestId] = None
    stage: AgentStage = AgentStage.IDLE
    payment_status: Optional[PaymentStatus] = None
    delivery_status: Optional[DeliveryStatus] = None
    transaction_hash: Optional[str] = None
    content_hash: Optional[str] = None
    error_reason: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def payment_tx(self) -> Optional[str]:
        """Alias for transaction_hash for dashboard compatibility."""
        return self.transaction_hash

    @model_validator(mode="before")
    @classmethod
    def map_payment_tx(cls, data: Any) -> Any:
        """Allow payment_tx to be passed as an alias for transaction_hash."""
        if isinstance(data, dict):
            if "payment_tx" in data and "transaction_hash" not in data:
                data["transaction_hash"] = data["payment_tx"]
        return data

    def to_dashboard_dict(self) -> dict[str, Any]:
        """Convert state to a clean JSON-serializable dictionary for dashboard presentation."""
        return {
            "current_task": self.current_task,
            "provider": self.provider,
            "amount": str(self.amount) if self.amount is not None else None,
            "currency": self.currency,
            "request_id": str(self.request_id) if self.request_id is not None else None,
            "stage": self.stage.value,
            "payment_status": self.payment_status.value if self.payment_status else None,
            "delivery_status": self.delivery_status.value if self.delivery_status else None,
            "payment_tx": self.transaction_hash,
            "transaction_hash": self.transaction_hash,
            "content_hash": self.content_hash,
            "error_reason": self.error_reason,
            "timestamp": self.timestamp.isoformat(),
        }
