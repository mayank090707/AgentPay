"""
Person 2 - AI Agent + Payment Foundation Package.

Phase 1 Foundation and Domain Layer.
Provides typed models, settings, state management, event dispatching, structured logging,
and domain exceptions.
"""

from agent.src.config import Settings, get_settings, reload_settings
from agent.src.events import AgentEvent, AgentEventType, EventEmitter
from agent.src.exceptions import (
    AgentError,
    BudgetExceededError,
    ConfigurationError,
    ContractError,
    DeliveryError,
    DuplicateRequestError,
    InvalidPaymentRequirementError,
    InvalidRequestError,
    PaymentAuthorizationError,
    PaymentError,
    PaymentTransactionError,
    ProviderError,
    RetryError,
    UnauthorizedAgentError,
)
from agent.src.logger import (
    clear_secrets,
    configure_logging,
    get_logger,
    register_secret,
)
from agent.src.models import (
    AgentStage,
    AgentState,
    DeliveryResult,
    DeliveryStatus,
    PaymentRequirement,
    PaymentResult,
    PaymentStatus,
    RequestId,
    ServiceReceipt,
    ServiceRequest,
)
from agent.src.orchestrator import Orchestrator
from agent.src.provider_client import ProviderClient, ProviderResponse
from agent.src.state import StateManager

__all__ = [
    # Provider Boundary & Orchestration
    "ProviderClient",
    "ProviderResponse",
    "Orchestrator",
    # Config
    "Settings",
    "get_settings",
    "reload_settings",
    # Models & Enums
    "RequestId",
    "AgentStage",
    "PaymentStatus",
    "DeliveryStatus",
    "ServiceRequest",
    "PaymentRequirement",
    "PaymentResult",
    "DeliveryResult",
    "ServiceReceipt",
    "AgentState",
    # Exceptions
    "AgentError",
    "ConfigurationError",
    "InvalidRequestError",
    "InvalidPaymentRequirementError",
    "ProviderError",
    "PaymentError",
    "PaymentTransactionError",
    "ContractError",
    "PaymentAuthorizationError",
    "BudgetExceededError",
    "DuplicateRequestError",
    "UnauthorizedAgentError",
    "DeliveryError",
    "RetryError",
    # State
    "StateManager",
    # Events
    "AgentEventType",
    "AgentEvent",
    "EventEmitter",
    # Logging
    "get_logger",
    "configure_logging",
    "register_secret",
    "clear_secrets",
]
