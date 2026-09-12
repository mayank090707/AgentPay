"""
Domain exception hierarchy for Person 2 (AI Agent + Payment).

All exceptions inherit from AgentError and provide structured context
(error code, message, optional request_id, and optional details).
No Web3, HTTP, or provider-specific details are implemented here.
"""

from typing import Any, Optional


class AgentError(Exception):
    """Base exception for all agent domain errors."""

    def __init__(
        self,
        message: str,
        code: str = "AGENT_ERROR",
        request_id: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.request_id = request_id
        self.details = details or {}

    def __str__(self) -> str:
        ctx = []
        if self.request_id:
            ctx.append(f"request_id={self.request_id}")
        if self.code:
            ctx.append(f"code={self.code}")
        suffix = f" [{', '.join(ctx)}]" if ctx else ""
        return f"{self.message}{suffix}"

    def to_dict(self) -> dict[str, Any]:
        """Serialize the exception into a structured dictionary for logging or dashboard events."""
        return {
            "error_type": self.__class__.__name__,
            "message": self.message,
            "code": self.code,
            "request_id": self.request_id,
            "details": self.details,
        }


class ConfigurationError(AgentError, ValueError):
    """Raised when configuration is invalid or missing."""

    def __init__(
        self,
        message: str,
        code: str = "CONFIG_ERROR",
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message=message, code=code, details=details)


class InvalidRequestError(AgentError, ValueError):
    """Raised when a service request format or parameter set is invalid."""

    def __init__(
        self,
        message: str,
        code: str = "INVALID_REQUEST",
        request_id: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message=message, code=code, request_id=request_id, details=details)


class InvalidPaymentRequirementError(AgentError, ValueError):
    """Raised when a payment requirement payload is malformed or invalid."""

    def __init__(
        self,
        message: str,
        code: str = "INVALID_PAYMENT_REQUIREMENT",
        request_id: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message=message, code=code, request_id=request_id, details=details)


class ProviderError(AgentError):
    """Raised when an external provider encounters or signals an error."""

    def __init__(
        self,
        message: str,
        code: str = "PROVIDER_ERROR",
        request_id: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message=message, code=code, request_id=request_id, details=details)


class PaymentError(AgentError):
    """Base exception for payment-related failures."""

    def __init__(
        self,
        message: str,
        code: str = "PAYMENT_ERROR",
        request_id: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message=message, code=code, request_id=request_id, details=details)


class PaymentTransactionError(PaymentError):
    """Raised when a payment transaction fails during execution or confirmation."""

    def __init__(
        self,
        message: str,
        code: str = "PAYMENT_TRANSACTION_FAILED",
        request_id: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message=message, code=code, request_id=request_id, details=details)


class ContractError(AgentError):
    """Base exception for smart contract authorization and interaction failures."""

    def __init__(
        self,
        message: str,
        code: str = "CONTRACT_ERROR",
        request_id: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message=message, code=code, request_id=request_id, details=details)


class PaymentAuthorizationError(ContractError):
    """Raised when smart contract authorization is rejected or fails."""

    def __init__(
        self,
        message: str,
        code: str = "PAYMENT_AUTHORIZATION_FAILED",
        request_id: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message=message, code=code, request_id=request_id, details=details)


class BudgetExceededError(ContractError):
    """
    Raised when the smart contract rejects payment authorization due to spending budget limits.

    ARCHITECTURAL RULE: The smart contract is the sole authority for budget enforcement.
    This exception is raised in response to contract rejection, never by local agent security logic.
    """

    def __init__(
        self,
        message: str = "Smart contract rejected payment: budget exceeded",
        code: str = "BUDGET_EXCEEDED",
        request_id: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message=message, code=code, request_id=request_id, details=details)


class DuplicateRequestError(ContractError):
    """Raised when the smart contract rejects payment due to an existing/duplicate request_id."""

    def __init__(
        self,
        message: str = "Smart contract rejected payment: duplicate request_id",
        code: str = "DUPLICATE_REQUEST",
        request_id: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message=message, code=code, request_id=request_id, details=details)


class UnauthorizedAgentError(ContractError):
    """Raised when the calling agent address is not authorized by the smart contract."""

    def __init__(
        self,
        message: str = "Smart contract rejected caller: agent not authorized",
        code: str = "UNAUTHORIZED_AGENT",
        request_id: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message=message, code=code, request_id=request_id, details=details)


class DeliveryError(AgentError):
    """Raised when service delivery or fulfillment fails."""

    def __init__(
        self,
        message: str,
        code: str = "DELIVERY_FAILED",
        request_id: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message=message, code=code, request_id=request_id, details=details)


class RetryError(AgentError):
    """Raised when all retry attempts for an operation have been exhausted."""

    def __init__(
        self,
        message: str,
        code: str = "RETRY_EXHAUSTED",
        request_id: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message=message, code=code, request_id=request_id, details=details)
