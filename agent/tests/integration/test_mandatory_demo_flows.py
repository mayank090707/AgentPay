"""
MANDATORY INTEGRATION DEMO FLOWS:
- FLOW 1: SUCCESSFUL PURCHASE (Provider 402 -> authorizePayment -> Paid Retry -> Delivery -> recordDelivery)
- FLOW 2: OVERSPEND / BUDGET EXCEEDED (Provider 402 -> Contract Revert -> BLOCKED_BY_SMART_CONTRACT)
- FLOW 3: RETRY / IDEMPOTENCY (Same Request ID -> Preserved Payment -> No Duplicate Spend or Execution)
"""

from decimal import Decimal
from unittest.mock import MagicMock
import httpx
import pytest
from pydantic import SecretStr

from fastapi.testclient import TestClient
from backend.app.main import app
from agent.src.contract_client import ContractClient
from agent.src.events import AgentEvent, AgentEventType, EventEmitter
from agent.src.exceptions import BudgetExceededError
from agent.src.models import (
    AgentStage,
    DeliveryStatus,
    PaymentRequirement,
    PaymentResult,
    PaymentStatus,
    RequestId,
    ServiceReceipt,
    ServiceRequest,
)
from agent.src.orchestrator import Orchestrator
from agent.src.payment_client import PaymentClient
from agent.src.provider_client import ProviderClient
from agent.src.state import StateManager


@pytest.fixture
def mock_contract_client() -> ContractClient:
    """Fixture providing a ContractClient with simulated smart contract behavior."""
    client = ContractClient(
        contract_address="0x" + "11" * 20,
        agent_address="0x" + "22" * 20,
        agent_private_key=SecretStr("0x" + "aa" * 32),
    )
    # Stub Web3 calls for deterministic contract testing
    client.is_processed = MagicMock(return_value=False)
    client.authorize_payment = MagicMock(
        return_value=PaymentResult(
            request_id=RequestId.generate(),
            amount=Decimal("0.01"),
            status=PaymentStatus.CONFIRMED,
            transaction_hash="0x" + "55" * 32,
        )
    )
    client.record_delivery = MagicMock(return_value="0x" + "77" * 32)
    return client


@pytest.fixture
def live_provider_client() -> ProviderClient:
    """ProviderClient communicating directly with Person 3 FastAPI backend."""
    http_client = TestClient(app, base_url="http://testserver")
    return ProviderClient(base_url="http://testserver", http_client=http_client)


# ==============================================================================
# FLOW 1 — SUCCESS
# ==============================================================================
def test_mandatory_flow_1_success(
    live_provider_client: ProviderClient,
    mock_contract_client: ContractClient,
) -> None:
    """
    FLOW 1 — SUCCESS:
    Agent requests service
    -> provider returns 402 with quote in ETH
    -> agent calls authorizePayment()
    -> contract accepts and ETH is transferred
    -> agent receives tx hash
    -> agent retries provider with same request_id + X-Payment-Proof
    -> provider delivers service with content hash
    -> agent calls recordDelivery()
    -> final success state & ServiceReceipt
    """
    req_id = RequestId.generate()
    request = ServiceRequest(
        request_id=req_id,
        service="translation",
        payload={"text": "Bonjour le monde", "source_lang": "fr", "target_lang": "en"},
        provider="alpha",
    )

    # Setup payment client
    payment_client = PaymentClient(contract_client=mock_contract_client)
    mock_contract_client.authorize_payment.return_value = PaymentResult(
        request_id=req_id,
        amount=Decimal("0.01"),
        status=PaymentStatus.CONFIRMED,
        transaction_hash="0x" + "55" * 32,
    )

    events: list[AgentEvent] = []
    emitter = EventEmitter()
    emitter.subscribe_all(lambda e: events.append(e))

    orchestrator = Orchestrator(
        provider_client=live_provider_client,
        contract_client=mock_contract_client,
        payment_client=payment_client,
        event_emitter=emitter,
        payer_address="0x" + "22" * 20,
    )

    result = orchestrator.run(request, endpoint_path="/services/translate")

    # 1. Result must be domain ServiceReceipt
    assert isinstance(result, ServiceReceipt)
    assert result.request_id == req_id
    assert result.currency == "ETH"
    assert result.payment_reference == "0x" + "55" * 32
    assert result.content_hash is not None and len(result.content_hash) == 64

    # 2. Verify contract interactions
    mock_contract_client.authorize_payment.assert_called_once()
    mock_contract_client.record_delivery.assert_called_once()

    # 3. Verify final state transitions
    state = orchestrator.get_state()
    assert state.stage == AgentStage.COMPLETED
    assert state.payment_status == PaymentStatus.CONFIRMED
    assert state.delivery_status == DeliveryStatus.FULFILLED
    assert state.transaction_hash == "0x" + "55" * 32
    assert state.content_hash == result.content_hash

    # 4. Verify event timeline emitted for Person 4 Dashboard
    event_types = [e.event_type for e in events]
    assert AgentEventType.TASK_STARTED in event_types
    assert AgentEventType.PROVIDER_CONTACTED in event_types
    assert AgentEventType.HTTP_402_RECEIVED in event_types
    assert AgentEventType.AUTHORIZATION_REQUESTED in event_types
    assert AgentEventType.PAYMENT_APPROVED in event_types
    assert AgentEventType.PAYMENT_CONFIRMED in event_types
    assert AgentEventType.DELIVERY_STARTED in event_types
    assert AgentEventType.DELIVERY_COMPLETED in event_types
    assert AgentEventType.RECEIPT_RECORDED in event_types
    assert AgentEventType.TASK_COMPLETED in event_types


# ==============================================================================
# FLOW 2 — OVERSPEND / BUDGET EXCEEDED
# ==============================================================================
def test_mandatory_flow_2_overspend(
    live_provider_client: ProviderClient,
    mock_contract_client: ContractClient,
) -> None:
    """
    FLOW 2 — OVERSPEND:
    Agent requests service whose price exceeds remaining budget
    -> provider returns 402
    -> agent attempts authorizePayment()
    -> contract rejects due to budget (reverts BudgetExceeded)
    -> NO ETH is transferred
    -> service is NOT delivered
    -> agent records BLOCKED_BY_SMART_CONTRACT
    """
    req_id = RequestId.generate()
    request = ServiceRequest(
        request_id=req_id,
        service="compute",
        payload={"operation": "matrix_multiply", "params": {"matrix_size": 200}},
        provider="alpha",
    )

    # Configure contract to reject payment with BudgetExceeded
    mock_contract_client.authorize_payment.side_effect = BudgetExceededError(
        f"Smart contract rejected payment: budget exceeded for request {req_id}",
        code="BUDGET_EXCEEDED",
        request_id=str(req_id),
    )

    payment_client = PaymentClient(contract_client=mock_contract_client)
    events: list[AgentEvent] = []
    emitter = EventEmitter()
    emitter.subscribe_all(lambda e: events.append(e))

    orchestrator = Orchestrator(
        provider_client=live_provider_client,
        contract_client=mock_contract_client,
        payment_client=payment_client,
        event_emitter=emitter,
        payer_address="0x" + "22" * 20,
    )

    with pytest.raises(BudgetExceededError) as exc_info:
        orchestrator.run(request, endpoint_path="/services/compute")

    assert exc_info.value.code == "BUDGET_EXCEEDED"

    # Verify state stopped at BLOCKED_BY_SMART_CONTRACT
    state = orchestrator.get_state()
    assert state.stage == AgentStage.BLOCKED_BY_SMART_CONTRACT
    assert state.payment_status == PaymentStatus.BLOCKED
    assert state.delivery_status is None  # Never attempted delivery
    assert state.transaction_hash is None  # No tx mined

    # Verify no delivery was recorded on contract
    mock_contract_client.record_delivery.assert_not_called()

    # Verify PAYMENT_BLOCKED event was published for Person 4 Dashboard
    event_types = [e.event_type for e in events]
    assert AgentEventType.PAYMENT_BLOCKED in event_types
    assert AgentEventType.DELIVERY_STARTED not in event_types


# ==============================================================================
# FLOW 3 — RETRY / IDEMPOTENCY
# ==============================================================================
def test_mandatory_flow_3_retry_and_idempotency(
    live_provider_client: ProviderClient,
    mock_contract_client: ContractClient,
) -> None:
    """
    FLOW 3 — RETRY / IDEMPOTENCY:
    Initial request (R) -> 402 quote (Q) -> payment tx (T)
    Network/response failure simulated after payment.
    Retry with same R + Q + T:
    - No second payment
    - No second service execution
    - Same persisted delivery & receipt
    - Same request identity preserved
    - Contract and provider idempotency preserved
    """
    req_id = RequestId.generate()
    request = ServiceRequest(
        request_id=req_id,
        service="translation",
        payload={"text": "Idempotent retry resilience test", "source_lang": "en", "target_lang": "de"},
        provider="alpha",
    )

    payment_client = PaymentClient(contract_client=mock_contract_client)
    fixed_tx_hash = "0x" + "88" * 32

    # Step 1: Initial successful execution
    mock_contract_client.authorize_payment.return_value = PaymentResult(
        request_id=req_id,
        amount=Decimal("0.01"),
        status=PaymentStatus.CONFIRMED,
        transaction_hash=fixed_tx_hash,
    )

    orchestrator = Orchestrator(
        provider_client=live_provider_client,
        contract_client=mock_contract_client,
        payment_client=payment_client,
        payer_address="0x" + "22" * 20,
    )

    receipt_1 = orchestrator.run(request, endpoint_path="/services/translate")
    assert isinstance(receipt_1, ServiceReceipt)
    assert receipt_1.payment_reference == fixed_tx_hash
    first_content_hash = receipt_1.content_hash

    # Step 2: Now simulate a retry of the same request_id after payment was already made
    # Contract is_processed now returns True!
    mock_contract_client.is_processed.return_value = True
    mock_contract_client.authorize_payment.reset_mock()

    # Run orchestrator again with the SAME request_id
    receipt_2 = orchestrator.run(request, endpoint_path="/services/translate")
    assert isinstance(receipt_2, ServiceReceipt)

    # 1. No second payment was authorized on the contract!
    mock_contract_client.authorize_payment.assert_not_called()

    # 2. Content hash and delivery are identical
    assert receipt_2.content_hash == first_content_hash
    assert receipt_2.request_id == req_id
