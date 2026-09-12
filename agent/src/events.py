"""
Typed event model and in-memory event dispatcher for Person 2 (AI Agent + Payment).

Enables event emission across the purchase lifecycle to allow Person 4 (Dashboard)
and other internal consumers to reconstruct the full sequence of events.

PHASE 1 ARCHITECTURAL BOUNDARY:
- In-memory event dispatcher and event history buffer.
- No network event bus (Kafka, RabbitMQ, Redis Pub/Sub, WebSockets) is implemented in this phase.
"""

from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
import threading
import uuid
from typing import Any, Callable, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from agent.src.models import AgentStage, AgentState


class AgentEventType(str, Enum):
    """Event types representing key lifecycle milestones in the agent workflow."""

    STAGE_CHANGED = "STAGE_CHANGED"
    TASK_STARTED = "TASK_STARTED"
    PROVIDER_CONTACTED = "PROVIDER_CONTACTED"
    HTTP_402_RECEIVED = "HTTP_402_RECEIVED"
    AUTHORIZATION_REQUESTED = "AUTHORIZATION_REQUESTED"
    PAYMENT_APPROVED = "PAYMENT_APPROVED"
    PAYMENT_BLOCKED = "PAYMENT_BLOCKED"
    PAYMENT_SUBMITTED = "PAYMENT_SUBMITTED"
    PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED"
    DELIVERY_STARTED = "DELIVERY_STARTED"
    DELIVERY_COMPLETED = "DELIVERY_COMPLETED"
    DELIVERY_FAILED = "DELIVERY_FAILED"
    RECEIPT_RECORDED = "RECEIPT_RECORDED"
    TASK_COMPLETED = "TASK_COMPLETED"
    TASK_FAILED = "TASK_FAILED"


class AgentEvent(BaseModel):
    """
    Typed event payload providing rich context for dashboard timeline reconstruction.
    """

    model_config = ConfigDict(extra="ignore")

    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: AgentEventType
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    request_id: Optional[str] = None
    service: Optional[str] = None
    provider: Optional[str] = None
    amount: Optional[Decimal] = None
    stage: AgentStage = AgentStage.IDLE
    transaction_hash: Optional[str] = None
    error: Optional[str] = None
    data: Dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_state(
        cls,
        event_type: AgentEventType,
        state: AgentState,
        error: Optional[str] = None,
        extra_data: Optional[Dict[str, Any]] = None,
    ) -> "AgentEvent":
        """Convenience constructor to create an event directly from current AgentState."""
        return cls(
            event_type=event_type,
            request_id=str(state.request_id) if state.request_id else None,
            service=state.current_task,
            provider=state.provider,
            amount=state.amount,
            stage=state.stage,
            transaction_hash=state.transaction_hash,
            error=error or state.error_reason,
            data=extra_data or {},
        )

    def to_dashboard_dict(self) -> Dict[str, Any]:
        """Format event payload for dashboard consumption."""
        return {
            "event_id": self.event_id,
            "event_type": self.event_type.value,
            "timestamp": self.timestamp.isoformat(),
            "request_id": self.request_id,
            "service": self.service,
            "provider": self.provider,
            "amount": str(self.amount) if self.amount is not None else None,
            "stage": self.stage.value,
            "transaction_hash": self.transaction_hash,
            "error": self.error,
            "data": self.data,
        }


class EventEmitter:
    """
    Thread-safe in-memory event dispatcher and history recorder.
    """

    def __init__(self, max_history: int = 1000) -> None:
        self._lock = threading.Lock()
        self._subscribers: Dict[AgentEventType, List[Callable[[AgentEvent], None]]] = {}
        self._wildcard_subscribers: List[Callable[[AgentEvent], None]] = []
        self._history: List[AgentEvent] = []
        self._max_history = max_history

    def subscribe(
        self,
        event_type: AgentEventType,
        handler: Callable[[AgentEvent], None],
    ) -> Callable[[], None]:
        """
        Subscribe a handler to a specific event type.
        Returns an unsubscribe callback.
        """
        with self._lock:
            if event_type not in self._subscribers:
                self._subscribers[event_type] = []
            self._subscribers[event_type].append(handler)

        def unsubscribe() -> None:
            with self._lock:
                if event_type in self._subscribers and handler in self._subscribers[event_type]:
                    self._subscribers[event_type].remove(handler)

        return unsubscribe

    def subscribe_all(self, handler: Callable[[AgentEvent], None]) -> Callable[[], None]:
        """
        Subscribe a handler to all event types.
        Returns an unsubscribe callback.
        """
        with self._lock:
            self._wildcard_subscribers.append(handler)

        def unsubscribe() -> None:
            with self._lock:
                if handler in self._wildcard_subscribers:
                    self._wildcard_subscribers.remove(handler)

        return unsubscribe

    def publish(self, event: AgentEvent) -> None:
        """
        Publish an event to all matching subscribers and append to event history.
        """
        with self._lock:
            # Store in history
            self._history.append(event)
            if len(self._history) > self._max_history:
                self._history.pop(0)

            # Snapshot listeners
            targeted = list(self._subscribers.get(event.event_type, []))
            wildcard = list(self._wildcard_subscribers)

        # Notify outside lock
        for handler in targeted:
            try:
                handler(event)
            except Exception:
                pass

        for handler in wildcard:
            try:
                handler(event)
            except Exception:
                pass

    def get_history(self, request_id: Optional[str] = None) -> List[AgentEvent]:
        """Retrieve historical events, optionally filtered by request_id."""
        with self._lock:
            if request_id is None:
                return list(self._history)
            return [e for e in self._history if e.request_id == request_id]

    def clear_history(self) -> None:
        """Clear recorded event history."""
        with self._lock:
            self._history.clear()
