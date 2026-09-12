"""
Deterministic lifecycle orchestrator skeleton for Person 2 (AI Agent + Payment).

Coordinates the initial provider-side service request lifecycle:
ServiceRequest -> TASK_RECEIVED -> PROVIDER_REQUESTED -> HTTP_402_RECEIVED or SERVICE_FULFILLED.

PHASE 2A ARCHITECTURAL BOUNDARIES:
- For HTTP 402: transitions to HTTP_402_RECEIVED, returns PaymentRequirement, and STOPS.
- Zero Web3, blockchain transactions, or contract calls.
- Zero PaymentClient or payment execution.
- Zero budget checks or Python-side budget enforcement.
- RequestId invariant: original request_id is never regenerated during the purchase lifecycle.
"""

from typing import Any, Optional, Union

from agent.src.events import AgentEvent, AgentEventType, EventEmitter
from agent.src.exceptions import AgentError
from agent.src.models import (
    AgentStage,
    AgentState,
    DeliveryResult,
    DeliveryStatus,
    PaymentRequirement,
    PaymentStatus,
    ServiceRequest,
)
from agent.src.provider_client import ProviderClient
from agent.src.state import StateManager


class Orchestrator:
    """
    Coordinates the agent lifecycle from service request through initial provider response.
    All external dependencies (provider client, state manager, event emitter) are injected.
    """

    def __init__(
        self,
        provider_client: ProviderClient,
        state_manager: Optional[StateManager] = None,
        event_emitter: Optional[EventEmitter] = None,
        default_endpoint_path: Optional[str] = None,
    ) -> None:
        self.provider_client = provider_client
        self.state_manager: StateManager = state_manager or StateManager()
        self.event_emitter: EventEmitter = event_emitter or EventEmitter()
        self.default_endpoint_path = default_endpoint_path

    def run(
        self,
        request: ServiceRequest,
        endpoint_path: Optional[str] = None,
    ) -> Union[DeliveryResult, PaymentRequirement]:
        """
        Execute the initial provider-side portion of the purchase lifecycle.

        Flow:
        1. TASK_RECEIVED
        2. PROVIDER_REQUESTED
        3. Call ProviderClient
        4. If HTTP 402: update state to HTTP_402_RECEIVED, emit event, return PaymentRequirement (STOP).
        5. If HTTP 2xx: update state to SERVICE_FULFILLED, emit event, return DeliveryResult.
        6. On failure: update state to FAILED, emit event, re-raise exception.
        """
        effective_endpoint = endpoint_path or self.default_endpoint_path

        # Step 1: TASK_RECEIVED (Preserve original request_id)
        state = self.state_manager.transition_to(
            AgentStage.TASK_RECEIVED,
            current_task=request.service,
            request_id=request.request_id,
            provider=request.provider,
        )
        self.event_emitter.publish(
            AgentEvent.from_state(AgentEventType.TASK_STARTED, state)
        )

        # Step 2: PROVIDER_REQUESTED
        state = self.state_manager.transition_to(AgentStage.PROVIDER_REQUESTED)
        self.event_emitter.publish(
            AgentEvent.from_state(AgentEventType.PROVIDER_CONTACTED, state)
        )

        # Step 3: Call ProviderClient
        try:
            response = self.provider_client.request_service(
                service_request=request,
                endpoint_path=effective_endpoint,
            )
        except AgentError as exc:
            state = self.state_manager.transition_to(
                AgentStage.FAILED,
                error_reason=str(exc),
                delivery_status=DeliveryStatus.FAILED,
            )
            self.event_emitter.publish(
                AgentEvent.from_state(AgentEventType.TASK_FAILED, state, error=str(exc))
            )
            raise

        # Step 4: Handle HTTP 402 (Payment Required)
        if response.is_payment_required and response.payment_requirement is not None:
            payment_req = response.payment_requirement
            state = self.state_manager.transition_to(
                AgentStage.HTTP_402_RECEIVED,
                amount=payment_req.amount,
                currency=payment_req.currency,
                provider=payment_req.provider,
                payment_status=PaymentStatus.PENDING,
            )
            self.event_emitter.publish(
                AgentEvent.from_state(
                    AgentEventType.HTTP_402_RECEIVED,
                    state,
                    extra_data={
                        "payment_address": payment_req.payment_address,
                        "network": payment_req.network,
                        "metadata": payment_req.metadata,
                    },
                )
            )
            # STOP HERE: Hand over PaymentRequirement for future payment processing
            return payment_req

        # Step 5: Handle HTTP 2xx (Service Delivered)
        if response.is_fulfilled and response.delivery_result is not None:
            delivery = response.delivery_result
            state = self.state_manager.transition_to(
                AgentStage.SERVICE_FULFILLED,
                delivery_status=DeliveryStatus.FULFILLED,
                content_hash=delivery.content_hash,
            )
            self.event_emitter.publish(
                AgentEvent.from_state(AgentEventType.DELIVERY_COMPLETED, state)
            )
            return delivery

        # Fallback for unexpected outcome
        state = self.state_manager.transition_to(
            AgentStage.FAILED,
            error_reason="Provider returned an unhandled response condition",
            delivery_status=DeliveryStatus.FAILED,
        )
        self.event_emitter.publish(
            AgentEvent.from_state(
                AgentEventType.TASK_FAILED,
                state,
                error=state.error_reason,
            )
        )
        raise AgentError(
            "Provider response did not contain delivery result or payment requirement",
            code="UNHANDLED_RESPONSE",
            request_id=str(request.request_id),
        )

    def get_state(self) -> AgentState:
        """Retrieve current orchestrator state."""
        return self.state_manager.get_state()
