"""
Deterministic retry and idempotency engine for Person 2 (AI Agent + Payment).

Implements safe retry policies with exponential backoff and strict idempotency protection:
- Never re-executes on-chain payment if request_id has already been processed.
- Safely retries provider paid delivery using the same request_id, quote_id, and tx_hash.
- Leverages smart contract isProcessed(bytes32) check as the source of payment truth.
"""

import time
from typing import Any, Callable, Optional, TypeVar

from agent.src.contract_client import ContractClient
from agent.src.exceptions import AgentError, ContractError, ProviderError, RetryError
from agent.src.logger import get_logger
from agent.src.models import RequestId

logger = get_logger("agent.retry")

T = TypeVar("T")


class RetryPolicy:
    """
    Exponential backoff configuration.
    """

    def __init__(
        self,
        max_attempts: int = 3,
        initial_delay: float = 0.5,
        backoff_factor: float = 2.0,
        max_delay: float = 5.0,
    ) -> None:
        self.max_attempts = max_attempts
        self.initial_delay = initial_delay
        self.backoff_factor = backoff_factor
        self.max_delay = max_delay

    def execute(
        self,
        operation: Callable[[], T],
        operation_name: str = "operation",
        request_id: Optional[str] = None,
        retryable_exceptions: tuple = (ProviderError, ConnectionError, TimeoutError),
    ) -> T:
        """
        Execute an operation with exponential backoff.
        """
        delay = self.initial_delay
        last_exception: Optional[Exception] = None

        for attempt in range(1, self.max_attempts + 1):
            try:
                return operation()
            except retryable_exceptions as exc:
                last_exception = exc
                logger.warning(
                    "%s failed (attempt %d/%d): %s [request_id=%s]",
                    operation_name, attempt, self.max_attempts, exc, request_id,
                )
                if attempt == self.max_attempts:
                    break
                time.sleep(delay)
                delay = min(delay * self.backoff_factor, self.max_delay)

        raise RetryError(
            f"{operation_name} failed after {self.max_attempts} attempts: {last_exception}",
            code="RETRY_EXHAUSTED",
            request_id=request_id,
            details={"attempts": self.max_attempts, "last_error": str(last_exception)},
        ) from last_exception


def check_idempotency_state(
    contract_client: Optional[ContractClient],
    request_id: RequestId,
) -> bool:
    """
    Check if the smart contract has already processed and paid this request_id.
    """
    if contract_client is None:
        return False
    try:
        return contract_client.is_processed(request_id)
    except Exception as exc:
        logger.error("Failed to query contract idempotency for %s: %s", request_id, exc)
        return False
