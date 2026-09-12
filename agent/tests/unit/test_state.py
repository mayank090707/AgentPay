"""Unit tests for StateManager and thread-safe in-memory state tracking."""

from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal

from agent.src.models import AgentStage, AgentState, PaymentStatus, RequestId
from agent.src.state import StateManager


def test_initial_state() -> None:
    """Verify initial state is IDLE."""
    mgr = StateManager()
    state = mgr.get_state()
    assert state.stage == AgentStage.IDLE
    assert state.current_task is None
    assert state.request_id is None


def test_update_state() -> None:
    """Verify state updates preserve previous fields while modifying target fields."""
    mgr = StateManager()
    req_id = RequestId.generate()

    mgr.update_state(
        current_task="compute-job",
        request_id=req_id,
        amount=Decimal("1.50"),
        currency="USDC",
    )
    s1 = mgr.get_state()
    assert s1.current_task == "compute-job"
    assert s1.request_id == req_id
    assert s1.amount == Decimal("1.50")
    assert s1.stage == AgentStage.IDLE

    # Secondary update
    mgr.update_state(provider="provider-beta")
    s2 = mgr.get_state()
    assert s2.current_task == "compute-job"
    assert s2.provider == "provider-beta"


def test_transition_to() -> None:
    """Verify transition_to updates stage and returns updated snapshot."""
    mgr = StateManager()
    state = mgr.transition_to(
        AgentStage.CONTRACT_AUTHORIZING,
        payment_status=PaymentStatus.PENDING,
    )
    assert state.stage == AgentStage.CONTRACT_AUTHORIZING
    assert state.payment_status == PaymentStatus.PENDING


def test_state_subscribers() -> None:
    """Verify subscriber notification and unsubscription."""
    mgr = StateManager()
    notifications = []

    def on_change(state: AgentState) -> None:
        notifications.append(state.stage)

    unsub = mgr.subscribe(on_change)

    mgr.transition_to(AgentStage.TASK_RECEIVED)
    mgr.transition_to(AgentStage.PROVIDER_REQUESTED)
    assert notifications == [AgentStage.TASK_RECEIVED, AgentStage.PROVIDER_REQUESTED]

    # Unsubscribe
    unsub()
    mgr.transition_to(AgentStage.HTTP_402_RECEIVED)
    # No new notification added after unsub
    assert len(notifications) == 2


def test_state_reset() -> None:
    """Verify reset clears fields back to IDLE."""
    mgr = StateManager()
    mgr.update_state(
        current_task="task-1",
        amount=Decimal("5.0"),
        stage=AgentStage.COMPLETED,
    )
    assert mgr.get_state().current_task == "task-1"

    reset_state = mgr.reset()
    assert reset_state.stage == AgentStage.IDLE
    assert reset_state.current_task is None
    assert reset_state.amount is None


def test_thread_safe_concurrent_updates() -> None:
    """Verify thread safety under concurrent updates."""
    mgr = StateManager()

    def worker(i: int) -> None:
        mgr.update_state(error_reason=f"worker-{i}")

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(worker, i) for i in range(50)]
        for f in futures:
            f.result()

    final_state = mgr.get_state()
    assert final_state.error_reason.startswith("worker-")
