"""Unit tests for domain exception hierarchy."""

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


def test_base_agent_error() -> None:
    """Verify AgentError string formatting and serialization."""
    err = AgentError(
        message="Something went wrong",
        code="TEST_ERROR",
        request_id="0x" + "11" * 32,
        details={"hint": "check logs"},
    )
    assert "Something went wrong" in str(err)
    assert "code=TEST_ERROR" in str(err)
    assert "request_id=0x" in str(err)

    d = err.to_dict()
    assert d["error_type"] == "AgentError"
    assert d["message"] == "Something went wrong"
    assert d["code"] == "TEST_ERROR"
    assert d["details"] == {"hint": "check logs"}


def test_exception_hierarchy() -> None:
    """Verify all domain exceptions correctly inherit from AgentError and specific sub-bases."""
    exceptions = [
        ConfigurationError("config issue"),
        InvalidRequestError("invalid request"),
        InvalidPaymentRequirementError("invalid payment requirement"),
        ProviderError("provider error"),
        PaymentError("payment base error"),
        PaymentTransactionError("tx failed"),
        ContractError("contract base error"),
        PaymentAuthorizationError("not authorized"),
        BudgetExceededError(),
        DuplicateRequestError(),
        UnauthorizedAgentError(),
        DeliveryError("delivery failed"),
        RetryError("retries exhausted"),
    ]

    for exc in exceptions:
        assert isinstance(exc, AgentError)
        assert isinstance(exc, Exception)

    # Sub-hierarchy assertions
    assert isinstance(PaymentTransactionError("tx err"), PaymentError)
    assert isinstance(PaymentAuthorizationError("auth err"), ContractError)
    assert isinstance(BudgetExceededError(), ContractError)
    assert isinstance(DuplicateRequestError(), ContractError)
    assert isinstance(UnauthorizedAgentError(), ContractError)


def test_budget_exceeded_error_defaults() -> None:
    """Verify BudgetExceededError defaults and architectural alignment."""
    err = BudgetExceededError(request_id="0x" + "22" * 32)
    assert err.code == "BUDGET_EXCEEDED"
    assert "budget exceeded" in err.message.lower()
    assert err.request_id == "0x" + "22" * 32
    assert isinstance(err, ContractError)
