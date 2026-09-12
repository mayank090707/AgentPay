"""Unit tests for domain models, enums, and state representation."""

from datetime import datetime
from decimal import Decimal

from pydantic import ValidationError
import pytest

from agent.src.exceptions import InvalidPaymentRequirementError, InvalidRequestError
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


def test_service_request_creation() -> None:
    """Verify ServiceRequest instantiation and default request_id generation."""
    req = ServiceRequest(
        service="compute-analysis",
        payload={"query": "analyze dataset"},
        provider="provider-alpha",
    )
    assert isinstance(req.request_id, RequestId)
    assert req.service == "compute-analysis"
    assert req.payload == {"query": "analyze dataset"}
    assert req.provider == "provider-alpha"
    assert req.parameters is None


def test_service_request_empty_service_rejected() -> None:
    """Verify ServiceRequest rejects empty service names."""
    with pytest.raises(ValidationError) as exc_info:
        ServiceRequest(service="", payload={})
    assert "EMPTY_SERVICE" in str(exc_info.value)

    with pytest.raises(ValidationError) as exc_info:
        ServiceRequest(service="   ", payload={})
    assert "EMPTY_SERVICE" in str(exc_info.value)


def test_payment_requirement_with_network() -> None:
    """Verify PaymentRequirement accepts network and validates positive amount."""
    req_id = RequestId.generate()
    req = PaymentRequirement(
        request_id=req_id,
        amount=Decimal("0.05"),
        currency="USDC",
        provider="provider-alpha",
        payment_address="0x1234567890123456789012345678901234567890",
        network="sepolia",
        metadata={"item": "tier_1"},
    )
    assert req.request_id == req_id
    assert req.amount == Decimal("0.05")
    assert req.currency == "USDC"
    assert req.network == "sepolia"
    assert req.metadata == {"item": "tier_1"}


def test_payment_requirement_zero_or_negative_amount_rejected() -> None:
    """Verify PaymentRequirement rejects non-positive payment amounts."""
    req_id = RequestId.generate()
    with pytest.raises(ValidationError) as exc_info:
        PaymentRequirement(
            request_id=req_id,
            amount=Decimal("0"),
            currency="USDC",
            provider="alpha",
            payment_address="0x123",
        )
    assert "INVALID_AMOUNT" in str(exc_info.value)

    with pytest.raises(ValidationError) as exc_info:
        PaymentRequirement(
            request_id=req_id,
            amount=Decimal("-1.5"),
            currency="USDC",
            provider="alpha",
            payment_address="0x123",
        )
    assert "INVALID_AMOUNT" in str(exc_info.value)


def test_payment_result_model() -> None:
    """Verify PaymentResult records status and transaction hash."""
    req_id = RequestId.generate()
    result = PaymentResult(
        request_id=req_id,
        amount=Decimal("1.25"),
        status=PaymentStatus.CONFIRMED,
        transaction_hash="0x" + "aa" * 32,
    )
    assert result.request_id == req_id
    assert result.status == PaymentStatus.CONFIRMED
    assert result.transaction_hash == "0x" + "aa" * 32
    assert result.error_reason is None


def test_delivery_result_semantics() -> None:
    """Verify DeliveryResult captures operational fulfillment outcome."""
    req_id = RequestId.generate()
    delivery = DeliveryResult(
        request_id=req_id,
        delivery_status=DeliveryStatus.FULFILLED,
        result={"report": "completed analysis"},
        content_hash="0x" + "bb" * 32,
    )
    assert delivery.request_id == req_id
    assert delivery.delivery_status == DeliveryStatus.FULFILLED
    assert delivery.result == {"report": "completed analysis"}
    assert delivery.content_hash == "0x" + "bb" * 32
    assert isinstance(delivery.timestamp, datetime)


def test_service_receipt_semantics() -> None:
    """Verify ServiceReceipt captures commercial purchase record without enforced frozen immutability."""
    req_id = RequestId.generate()
    receipt = ServiceReceipt(
        request_id=req_id,
        provider="provider-alpha",
        amount=Decimal("2.50"),
        currency="USDC",
        payment_reference="0x" + "cc" * 32,
        content_hash="0x" + "dd" * 32,
    )
    assert receipt.request_id == req_id
    assert receipt.amount == Decimal("2.50")
    assert receipt.currency == "USDC"
    assert receipt.payment_reference == "0x" + "cc" * 32
    assert receipt.content_hash == "0x" + "dd" * 32
    assert isinstance(receipt.timestamp, datetime)


def test_agent_state_dashboard_dict() -> None:
    """Verify AgentState dashboard serialization and payment_tx alias."""
    req_id = RequestId.generate()
    tx_hash = "0x" + "ee" * 32
    state = AgentState(
        current_task="market-analysis",
        provider="provider-alpha",
        amount=Decimal("0.75"),
        currency="USDC",
        request_id=req_id,
        stage=AgentStage.PAYMENT_CONFIRMED,
        payment_status=PaymentStatus.CONFIRMED,
        delivery_status=DeliveryStatus.PENDING,
        transaction_hash=tx_hash,
    )

    # Verify alias property
    assert state.payment_tx == tx_hash

    # Verify dashboard dict format
    d = state.to_dashboard_dict()
    assert d["current_task"] == "market-analysis"
    assert d["provider"] == "provider-alpha"
    assert d["amount"] == "0.75"
    assert d["currency"] == "USDC"
    assert d["request_id"] == str(req_id)
    assert d["stage"] == "PAYMENT_CONFIRMED"
    assert d["payment_status"] == "CONFIRMED"
    assert d["delivery_status"] == "PENDING"
    assert d["payment_tx"] == tx_hash
    assert d["transaction_hash"] == tx_hash


def test_lifecycle_enums() -> None:
    """Verify all critical lifecycle stages and statuses exist and are typed."""
    assert AgentStage.IDLE.value == "IDLE"
    assert AgentStage.TASK_RECEIVED.value == "TASK_RECEIVED"
    assert AgentStage.PROVIDER_REQUESTED.value == "PROVIDER_REQUESTED"
    assert AgentStage.HTTP_402_RECEIVED.value == "HTTP_402_RECEIVED"
    assert AgentStage.CONTRACT_AUTHORIZING.value == "CONTRACT_AUTHORIZING"
    assert AgentStage.PAYMENT_APPROVED.value == "PAYMENT_APPROVED"
    assert AgentStage.BLOCKED_BY_SMART_CONTRACT.value == "BLOCKED_BY_SMART_CONTRACT"
    assert AgentStage.PAYMENT_SUBMITTED.value == "PAYMENT_SUBMITTED"
    assert AgentStage.PAYMENT_CONFIRMED.value == "PAYMENT_CONFIRMED"
    assert AgentStage.DELIVERY_PENDING.value == "DELIVERY_PENDING"
    assert AgentStage.SERVICE_FULFILLED.value == "SERVICE_FULFILLED"
    assert AgentStage.DELIVERY_FAILED.value == "DELIVERY_FAILED"
    assert AgentStage.RECEIPT_RECORDED.value == "RECEIPT_RECORDED"
    assert AgentStage.RETRYING.value == "RETRYING"
    assert AgentStage.COMPLETED.value == "COMPLETED"
    assert AgentStage.FAILED.value == "FAILED"
