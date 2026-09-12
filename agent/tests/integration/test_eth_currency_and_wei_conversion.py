"""
Integration tests for Native ETH currency validation and exact Decimal-to-wei conversions.
"""

from decimal import Decimal
import pytest

from agent.src.contract_client import ContractClient
from agent.src.exceptions import InvalidPaymentRequirementError
from agent.src.models import PaymentRequirement, RequestId
from agent.src.payment_client import PaymentClient, eth_to_wei


def test_eth_to_wei_exact_conversion() -> None:
    """Verify exact integer wei conversion for various ETH denominations."""
    assert eth_to_wei(Decimal("1.0")) == 10**18
    assert eth_to_wei(Decimal("0.01")) == 10_000_000_000_000_000
    assert eth_to_wei(Decimal("0.001")) == 1_000_000_000_000_000
    assert eth_to_wei("0.000000000000000001") == 1  # 1 wei (10^-18)
    assert eth_to_wei("0.5") == 500_000_000_000_000_000
    assert eth_to_wei(2) == 2 * 10**18


def test_eth_to_wei_invalid_inputs_rejected() -> None:
    """Verify zero, negative, or invalid amounts are strictly rejected."""
    with pytest.raises(ValueError, match="must be positive"):
        eth_to_wei("0")

    with pytest.raises(ValueError, match="must be positive"):
        eth_to_wei("-0.5")

    with pytest.raises(ValueError, match="cannot parse as Decimal"):
        eth_to_wei("invalid_eth")


def test_eth_to_wei_sub_wei_precision_rejected() -> None:
    """Verify fractional amounts below 1 wei (e.g. 10^-19) raise ValueError."""
    with pytest.raises(ValueError, match="sub-wei precision"):
        eth_to_wei("0.0000000000000000001")


def test_payment_client_rejects_non_eth_currency() -> None:
    """
    CRITICAL ARCHITECTURAL RULE:
    PaymentClient strictly requires native ETH and rejects USDC or other currencies.
    """
    mock_contract_client = object()  # Not called
    payment_client = PaymentClient(contract_client=mock_contract_client)  # type: ignore

    usdc_requirement = PaymentRequirement(
        request_id=RequestId.generate(),
        amount=Decimal("10.0"),
        currency="USDC",
        provider="alpha",
        payment_address="0x" + "11" * 20,
    )

    with pytest.raises(InvalidPaymentRequirementError) as exc_info:
        payment_client.process_payment(usdc_requirement, service="translation")

    assert exc_info.value.code == "UNSUPPORTED_CURRENCY"
    assert "ETH" in str(exc_info.value)
