"""Unit tests for Orchestrator skeleton."""

from decimal import Decimal
from typing import List, Optional
from unittest.mock import MagicMock

import pytest

from agent.src.events import AgentEvent, AgentEventType, EventEmitter
from agent.src.exceptions import ConfigurationError, ProviderError
from agent.src.models import (
    AgentStage,
    DeliveryResult,
    DeliveryStatus,
    PaymentRequirement,
    PaymentStatus,
    RequestId,
    ServiceRequest,
)
from agent.src.orchestrator import Orchestrator
from agent.src.provider_client import ProviderClient, ProviderResponse
from agent.src.state import StateManager


class StubProviderClient(ProviderClient):
    """Stub ProviderClient for deterministic testing without network interaction."""

    def __init__(self, response_to_return: Optional[ProviderResponse] = None, error_to_raise: Optional[Exception] = None) -> None:
        super().__init__(base_url="https://stub.provider.test")
        self.response_to_return = response_to_return
        self.error_to_raise = error_to_raise
        self.last_service_request: Optional[ServiceRequest] = None
        self.last_endpoint_path: Optional[str] = None

    def request_service(
        self,
        service_request: ServiceRequest,
        endpoint_path: Optional[str] = None,
    ) -> ProviderResponse:
        self.last_service_request = service_request
        self.last_endpoint_path = endpoint_path

        if not endpoint_path:
            raise ConfigurationError(
                "Provider endpoint_path must be explicitly provided",
                code="MISSING_ENDPOINT_PATH",
            )

        if self.error_to_raise is not None:
            raise self.error_to_raise

        if self.response_to_return is not None:
            return self.response_to_return

        raise RuntimeError("StubProviderClient configured with neither response nor error")


def test_successful_provider_flow() -> None:
    """Verify 200 response transitions to SERVICE_FULFILLED and returns DeliveryResult."""
    req_id = RequestId.generate()
    request = ServiceRequest(
        request_id=req_id,
        service="translation",
        payload={"text": "hello"},
        provider="provider-one",
    )

    delivery = DeliveryResult(
        request_id=req_id,
        delivery_status=DeliveryStatus.FULFILLED,
        result={"translated": "hola"},
        content_hash="0x" + "aa" * 32,
    )
    stub_client = StubProviderClient(
        response_to_return=ProviderResponse(status_code=200, delivery_result=delivery)
    )

    state_mgr = StateManager()
    events: List[AgentEvent] = []
    emitter = EventEmitter()
    emitter.subscribe_all(lambda e: events.append(e))

    orchestrator = Orchestrator(
        provider_client=stub_client,
        state_manager=state_mgr,
        event_emitter=emitter,
    )

    result = orchestrator.run(request, endpoint_path="translate")

    assert isinstance(result, DeliveryResult)
    assert result.request_id == req_id
    assert result.result == {"translated": "hola"}

    # Verify final state
    state = orchestrator.get_state()
    assert state.stage == AgentStage.SERVICE_FULFILLED
    assert state.delivery_status == DeliveryStatus.FULFILLED
    assert state.content_hash == "0x" + "aa" * 32
    assert state.current_task == "translation"
    assert state.request_id == req_id

    # Verify event emission sequence
    event_types = [e.event_type for e in events]
    assert event_types == [
        AgentEventType.TASK_STARTED,
        AgentEventType.PROVIDER_CONTACTED,
        AgentEventType.DELIVERY_COMPLETED,
    ]


def test_http_402_flow_returns_payment_requirement_and_stops() -> None:
    """
    CRITICAL ARCHITECTURAL TEST:
    Verify HTTP 402 transitions to HTTP_402_RECEIVED, returns PaymentRequirement, and STOPS.
    """
    req_id = RequestId.generate()
    request = ServiceRequest(
        request_id=req_id,
        service="compute-task",
        payload={"query": "data"},
        provider="compute-node-1",
    )

    payment_req = PaymentRequirement(
        request_id=req_id,
        amount=Decimal("0.50"),
        currency="USDC",
        provider="compute-node-1",
        payment_address="0x" + "33" * 20,
        network="sepolia",
        metadata={"priority": "high"},
    )
    stub_client = StubProviderClient(
        response_to_return=ProviderResponse(status_code=402, payment_requirement=payment_req)
    )

    state_mgr = StateManager()
    events: List[AgentEvent] = []
    emitter = EventEmitter()
    emitter.subscribe_all(lambda e: events.append(e))

    orchestrator = Orchestrator(
        provider_client=stub_client,
        state_manager=state_mgr,
        event_emitter=emitter,
    )

    result = orchestrator.run(request, endpoint_path="compute")

    # Returned object must be domain PaymentRequirement
    assert isinstance(result, PaymentRequirement)
    assert result.request_id == req_id
    assert result.amount == Decimal("0.50")
    assert result.currency == "USDC"
    assert result.payment_address == "0x" + "33" * 20
    assert result.network == "sepolia"

    # Verify state stopped at HTTP_402_RECEIVED
    state = orchestrator.get_state()
    assert state.stage == AgentStage.HTTP_402_RECEIVED
    assert state.amount == Decimal("0.50")
    assert state.currency == "USDC"
    assert state.provider == "compute-node-1"
    assert state.payment_status == PaymentStatus.PENDING
    # Ensure no subsequent stages were entered
    assert state.delivery_status is None
    assert state.transaction_hash is None

    # Verify events sequence stops at HTTP_402_RECEIVED
    event_types = [e.event_type for e in events]
    assert event_types == [
        AgentEventType.TASK_STARTED,
        AgentEventType.PROVIDER_CONTACTED,
        AgentEventType.HTTP_402_RECEIVED,
    ]


def test_provider_failure_transitions_to_failed() -> None:
    """Verify provider error transitions state to FAILED and re-raises exception."""
    req_id = RequestId.generate()
    request = ServiceRequest(
        request_id=req_id,
        service="inference",
        payload={},
    )

    error = ProviderError(
        message="Service unavailable",
        code="HTTP_503",
        request_id=str(req_id),
    )
    stub_client = StubProviderClient(error_to_raise=error)

    state_mgr = StateManager()
    events: List[AgentEvent] = []
    emitter = EventEmitter()
    emitter.subscribe_all(lambda e: events.append(e))

    orchestrator = Orchestrator(
        provider_client=stub_client,
        state_manager=state_mgr,
        event_emitter=emitter,
    )

    with pytest.raises(ProviderError) as exc_info:
        orchestrator.run(request, endpoint_path="infer")
    assert exc_info.value.code == "HTTP_503"

    state = orchestrator.get_state()
    assert state.stage == AgentStage.FAILED
    assert state.delivery_status == DeliveryStatus.FAILED
    assert "Service unavailable" in str(state.error_reason)

    event_types = [e.event_type for e in events]
    assert event_types == [
        AgentEventType.TASK_STARTED,
        AgentEventType.PROVIDER_CONTACTED,
        AgentEventType.TASK_FAILED,
    ]


def test_request_id_invariant_throughout_lifecycle() -> None:
    """
    CRITICAL INVARIANT TEST:
    Verify original request_id is preserved throughout all events, states, and return objects.
    Never regenerated.
    """
    req_id = RequestId.generate()
    request = ServiceRequest(
        request_id=req_id,
        service="service-alpha",
        payload={"k": "v"},
    )

    payment_req = PaymentRequirement(
        request_id=req_id,
        amount=Decimal("2.0"),
        currency="USDC",
        provider="alpha",
        payment_address="0x" + "44" * 20,
    )
    stub_client = StubProviderClient(
        response_to_return=ProviderResponse(status_code=402, payment_requirement=payment_req)
    )

    events: List[AgentEvent] = []
    emitter = EventEmitter()
    emitter.subscribe_all(lambda e: events.append(e))

    orchestrator = Orchestrator(
        provider_client=stub_client,
        event_emitter=emitter,
    )

    result = orchestrator.run(request, endpoint_path="task")

    # Invariant checks
    assert result.request_id == req_id
    assert orchestrator.get_state().request_id == req_id
    for event in events:
        assert event.request_id == str(req_id)


def test_default_endpoint_path_used() -> None:
    """Verify default_endpoint_path on Orchestrator is used when endpoint_path is omitted."""
    req = ServiceRequest(service="service-beta", payload={})
    delivery = DeliveryResult(
        request_id=req.request_id,
        delivery_status=DeliveryStatus.FULFILLED,
    )
    stub_client = StubProviderClient(
        response_to_return=ProviderResponse(status_code=200, delivery_result=delivery)
    )

    orchestrator = Orchestrator(
        provider_client=stub_client,
        default_endpoint_path="v1/default_route",
    )

    orchestrator.run(req)
    assert stub_client.last_endpoint_path == "v1/default_route"


def test_missing_endpoint_path_fails_cleanly() -> None:
    """Verify running orchestrator without endpoint_path or default_endpoint_path raises ConfigurationError."""
    req = ServiceRequest(service="service-beta", payload={})
    stub_client = StubProviderClient()

    orchestrator = Orchestrator(provider_client=stub_client)

    with pytest.raises(ConfigurationError) as exc_info:
        orchestrator.run(req)
    assert exc_info.value.code == "MISSING_ENDPOINT_PATH"

    # Verify state transitioned to FAILED
    assert orchestrator.get_state().stage == AgentStage.FAILED
