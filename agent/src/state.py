"""
In-memory state manager for Person 2 (AI Agent + Payment).

Provides thread-safe management of the agent's current state and supports
state transition listeners for downstream event emission and dashboard updates.

PHASE 1 ARCHITECTURAL BOUNDARY:
- Strictly in-memory.
- No database, Redis, or persistence layers are implemented in this phase.
"""

from datetime import datetime, timezone
import threading
from typing import Any, Callable, List, Optional

from agent.src.models import AgentStage, AgentState


class StateManager:
    """
    Thread-safe in-memory state manager for holding and transitioning AgentState.
    """

    def __init__(self, initial_state: Optional[AgentState] = None) -> None:
        self._lock = threading.Lock()
        self._state: AgentState = initial_state or AgentState()
        self._subscribers: List[Callable[[AgentState], None]] = []

    def get_state(self) -> AgentState:
        """Retrieve a copy of the current agent state."""
        with self._lock:
            return self._state.model_copy()

    def update_state(self, **kwargs: Any) -> AgentState:
        """
        Update specific fields of the current state safely.
        Always updates the state timestamp unless explicitly provided.
        """
        with self._lock:
            if "timestamp" not in kwargs:
                kwargs["timestamp"] = datetime.now(timezone.utc)
            # Create a new updated state using model_copy with update
            current_dict = self._state.model_dump()
            current_dict.update(kwargs)
            self._state = AgentState(**current_dict)
            snapshot = self._state.model_copy()

        self._notify_subscribers(snapshot)
        return snapshot

    def transition_to(self, stage: AgentStage, **kwargs: Any) -> AgentState:
        """
        Transition the agent to a new lifecycle stage with optional accompanying updates.
        """
        kwargs["stage"] = stage
        return self.update_state(**kwargs)

    def reset(self) -> AgentState:
        """
        Reset state to IDLE with all fields cleared.
        Primarily used when starting a new purchase task or for test setup.
        """
        with self._lock:
            self._state = AgentState(
                stage=AgentStage.IDLE,
                timestamp=datetime.now(timezone.utc),
            )
            snapshot = self._state.model_copy()

        self._notify_subscribers(snapshot)
        return snapshot

    def subscribe(self, listener: Callable[[AgentState], None]) -> Callable[[], None]:
        """
        Register a callback to be invoked on every state change.
        Returns an unsubscribe callable.
        """
        with self._lock:
            self._subscribers.append(listener)

        def unsubscribe() -> None:
            with self._lock:
                if listener in self._subscribers:
                    self._subscribers.remove(listener)

        return unsubscribe

    def _notify_subscribers(self, state: AgentState) -> None:
        """Notify all registered subscribers of a state change."""
        with self._lock:
            subscribers_copy = list(self._subscribers)

        for listener in subscribers_copy:
            try:
                listener(state)
            except Exception:
                # Subscriber errors should not disrupt core state transitions
                pass
