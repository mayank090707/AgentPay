"""Unit tests for AgentEvent and in-memory EventEmitter."""

from decimal import Decimal

from agent.src.events import AgentEvent, AgentEventType, EventEmitter
from agent.src.models import AgentStage, AgentState, RequestId


def test_agent_event_creation() -> None:
    """Verify manual AgentEvent instantiation and dashboard serialization."""
    req_id = RequestId.generate()
    event = AgentEvent(
        event_type=AgentEventType.TASK_STARTED,
        request_id=str(req_id),
        service="translation",
        stage=AgentStage.TASK_RECEIVED,
        data={"lang": "es"},
    )
    assert event.event_type == AgentEventType.TASK_STARTED
    assert event.request_id == str(req_id)
    assert event.service == "translation"
    assert event.stage == AgentStage.TASK_RECEIVED
    assert event.data == {"lang": "es"}

    d = event.to_dashboard_dict()
    assert d["event_type"] == "TASK_STARTED"
    assert d["request_id"] == str(req_id)
    assert d["service"] == "translation"
    assert "timestamp" in d


def test_agent_event_from_state() -> None:
    """Verify AgentEvent.from_state constructor."""
    req_id = RequestId.generate()
    state = AgentState(
        current_task="data-fetch",
        provider="provider-x",
        amount=Decimal("0.10"),
        request_id=req_id,
        stage=AgentStage.PROVIDER_REQUESTED,
    )
    event = AgentEvent.from_state(
        event_type=AgentEventType.PROVIDER_CONTACTED,
        state=state,
        extra_data={"endpoint": "/query"},
    )
    assert event.event_type == AgentEventType.PROVIDER_CONTACTED
    assert event.request_id == str(req_id)
    assert event.service == "data-fetch"
    assert event.provider == "provider-x"
    assert event.amount == Decimal("0.10")
    assert event.stage == AgentStage.PROVIDER_REQUESTED
    assert event.data == {"endpoint": "/query"}


def test_event_emitter_dispatch_and_history() -> None:
    """Verify EventEmitter targeted and wildcard subscriptions, plus history retrieval."""
    emitter = EventEmitter(max_history=10)
    targeted_received = []
    wildcard_received = []

    unsub_targeted = emitter.subscribe(
        AgentEventType.PAYMENT_CONFIRMED,
        lambda e: targeted_received.append(e),
    )
    unsub_wildcard = emitter.subscribe_all(
        lambda e: wildcard_received.append(e),
    )

    req_id_1 = str(RequestId.generate())
    req_id_2 = str(RequestId.generate())

    e1 = AgentEvent(
        event_type=AgentEventType.TASK_STARTED,
        request_id=req_id_1,
        stage=AgentStage.TASK_RECEIVED,
    )
    e2 = AgentEvent(
        event_type=AgentEventType.PAYMENT_CONFIRMED,
        request_id=req_id_1,
        stage=AgentStage.PAYMENT_CONFIRMED,
    )
    e3 = AgentEvent(
        event_type=AgentEventType.TASK_STARTED,
        request_id=req_id_2,
        stage=AgentStage.TASK_RECEIVED,
    )

    emitter.publish(e1)
    emitter.publish(e2)
    emitter.publish(e3)

    # Targeted should only receive PAYMENT_CONFIRMED
    assert len(targeted_received) == 1
    assert targeted_received[0].event_type == AgentEventType.PAYMENT_CONFIRMED

    # Wildcard receives all
    assert len(wildcard_received) == 3

    # History filtering
    hist_all = emitter.get_history()
    assert len(hist_all) == 3

    hist_req1 = emitter.get_history(request_id=req_id_1)
    assert len(hist_req1) == 2

    hist_req2 = emitter.get_history(request_id=req_id_2)
    assert len(hist_req2) == 1

    # Unsubscribe
    unsub_targeted()
    unsub_wildcard()

    emitter.publish(
        AgentEvent(
            event_type=AgentEventType.PAYMENT_CONFIRMED,
            stage=AgentStage.PAYMENT_CONFIRMED,
        )
    )
    assert len(targeted_received) == 1
    assert len(wildcard_received) == 3


def test_event_emitter_max_history() -> None:
    """Verify buffer truncation at max_history limit."""
    emitter = EventEmitter(max_history=3)
    for i in range(5):
        emitter.publish(
            AgentEvent(
                event_type=AgentEventType.STAGE_CHANGED,
                stage=AgentStage.IDLE,
                data={"index": i},
            )
        )
    history = emitter.get_history()
    assert len(history) == 3
    assert history[0].data["index"] == 2
    assert history[-1].data["index"] == 4

    emitter.clear_history()
    assert len(emitter.get_history()) == 0
