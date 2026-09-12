"""
Deterministic lifecycle orchestrator for Person 2 (AI Agent + Payment).

Coordinates the complete end-to-end purchase lifecycle:
ServiceRequest -> TASK_RECEIVED -> PROVIDER_REQUESTED -> HTTP_402_RECEIVED
-> CONTRACT_AUTHORIZING -> PAYMENT_APPROVED -> PAYMENT_CONFIRMED
-> DELIVERY_PENDING -> SERVICE_FULFILLED -> RECEIPT_RECORDED -> COMPLETED

On Smart Contract rejection (e.g. BudgetExceeded):
-> BLOCKED_BY_SMART_CONTRACT -> Error event -> Re-raises exception

ARCHITECTURAL PRINCIPLES:
- Smart contract transaction is the final spending and security boundary.
- Orchestrator contains zero Web3/Solidity internals; coordinates injected clients.
- Invariant: Original RequestId (32-byte hex) is preserved across all hops.
- Strict native ETH denomination.
- Backward compatibility: If no PaymentClient is injected, stops at HTTP_402_RECEIVED.
"""

from decimal import Decimal
from typing import Any, Optional, Union

from agent.src.contract_client import ContractClient
from agent.src.events import AgentEvent, AgentEventType, EventEmitter
from agent.src.exceptions import (
    AgentError,
    BudgetExceededError,
    ContractError,
    DeliveryError,
    PaymentAuthorizationError,
    PaymentError,
    ProviderError,
)
from agent.src.logger import get_logger
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
from agent.src.payment_client import PaymentClient
from agent.src.provider_client import ProviderClient
from agent.src.state import StateManager

logger = get_logger("agent.orchestrator")


class Orchestrator:
    """
    Coordinates the agent lifecycle from service request through on-chain authorization,
    provider delivery, on-chain delivery verification, and receipt persistence.
    """

    def __init__(
        self,
        provider_client: ProviderClient,
        state_manager: Optional[StateManager] = None,
        event_emitter: Optional[EventEmitter] = None,
        default_endpoint_path: Optional[str] = None,
        contract_client: Optional[ContractClient] = None,
        payment_client: Optional[PaymentClient] = None,
        payer_address: Optional[str] = None,
    ) -> None:
        self.provider_client = provider_client
        self.state_manager: StateManager = state_manager or StateManager()
        self.event_emitter: EventEmitter = event_emitter or EventEmitter()
        self.default_endpoint_path = default_endpoint_path
        self.contract_client = contract_client
        self.payment_client = payment_client
        self.payer_address = payer_address

    def run(
        self,
        request: ServiceRequest,
        endpoint_path: Optional[str] = None,
    ) -> Union[DeliveryResult, PaymentRequirement, ServiceReceipt]:
        """
        Execute the purchase lifecycle.

        If payment_client is not configured:
            Runs Phase 2A provider-side handshake: stops at HTTP_402_RECEIVED and returns PaymentRequirement.
        If payment_client is configured:
            Executes the full end-to-end integration:
            Request -> 402 -> Smart Contract authorizePayment -> Paid Provider Retry -> recordDelivery -> ServiceReceipt.
        """
        effective_endpoint = endpoint_path or self.default_endpoint_path
        req_id_str = str(request.request_id)

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

        # Step 3: Call ProviderClient for initial request
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

            # If no PaymentClient is configured, stop and hand over requirement (Phase 2A behavior)
            if self.payment_client is None:
                return payment_req

            # Step 5: Full Payment & Delivery Flow
            return self._execute_payment_and_delivery(
                request=request,
                payment_req=payment_req,
                endpoint_path=effective_endpoint,
            )

        # Step 5: Handle HTTP 2xx without prior payment (e.g. free service or replayed delivery)
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
            # If response contains a persisted receipt from an idempotent replay, return ServiceReceipt
            if isinstance(delivery.result, dict) and delivery.result.get("receipt"):
                rec_data = delivery.result["receipt"]
                receipt = ServiceReceipt(
                    request_id=delivery.request_id,
                    provider=rec_data.get("provider_address") or request.provider or "provider",
                    amount=Decimal(str(rec_data.get("amount", "0"))),
                    currency=rec_data.get("currency", "ETH"),
                    payment_reference=rec_data.get("tx_hash", "REPLAYED"),
                    content_hash=delivery.content_hash or rec_data.get("content_hash", ""),
                )
                state = self.state_manager.transition_to(AgentStage.COMPLETED)
                self.event_emitter.publish(AgentEvent.from_state(AgentEventType.TASK_COMPLETED, state))
                return receipt

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
            request_id=req_id_str,
        )

    def _execute_payment_and_delivery(
        self,
        request: ServiceRequest,
        payment_req: PaymentRequirement,
        endpoint_path: Optional[str],
    ) -> ServiceReceipt:
        """
        Coordinates on-chain payment authorization, paid retry with X-Payment-Proof,
        on-chain delivery hash recording, and receipt issuance.
        """
        assert self.payment_client is not None
        req_id_str = str(request.request_id)

        # 1. CONTRACT_AUTHORIZING
        state = self.state_manager.transition_to(
            AgentStage.CONTRACT_AUTHORIZING,
            payment_status=PaymentStatus.PENDING,
        )
        self.event_emitter.publish(
            AgentEvent.from_state(AgentEventType.AUTHORIZATION_REQUESTED, state)
        )

        # 2. Process payment via PaymentClient -> ContractClient -> AgentPay.sol
        try:
            payment_result = self.payment_client.process_payment(
                requirement=payment_req,
                service=request.service,
            )
        except BudgetExceededError as exc:
            state = self.state_manager.transition_to(
                AgentStage.BLOCKED_BY_SMART_CONTRACT,
                payment_status=PaymentStatus.BLOCKED,
                error_reason=str(exc),
            )
            self.event_emitter.publish(
                AgentEvent.from_state(
                    AgentEventType.PAYMENT_BLOCKED,
                    state,
                    error=str(exc),
                )
            )
            raise
        except ContractError as exc:
            state = self.state_manager.transition_to(
                AgentStage.FAILED,
                payment_status=PaymentStatus.FAILED,
                error_reason=str(exc),
            )
            self.event_emitter.publish(
                AgentEvent.from_state(
                    AgentEventType.TASK_FAILED,
                    state,
                    error=str(exc),
                )
            )
            raise

        # 3. PAYMENT_APPROVED & PAYMENT_CONFIRMED
        state = self.state_manager.transition_to(
            AgentStage.PAYMENT_APPROVED,
            payment_status=PaymentStatus.APPROVED,
        )
        self.event_emitter.publish(
            AgentEvent.from_state(AgentEventType.PAYMENT_APPROVED, state)
        )

        state = self.state_manager.transition_to(
            AgentStage.PAYMENT_CONFIRMED,
            payment_status=PaymentStatus.CONFIRMED,
            transaction_hash=payment_result.transaction_hash,
        )
        self.event_emitter.publish(
            AgentEvent.from_state(AgentEventType.PAYMENT_CONFIRMED, state)
        )

        # 4. Resubmit to Provider with X-Payment-Proof (DELIVERY_PENDING)
        state = self.state_manager.transition_to(
            AgentStage.DELIVERY_PENDING,
            delivery_status=DeliveryStatus.PENDING,
        )
        self.event_emitter.publish(
            AgentEvent.from_state(AgentEventType.DELIVERY_STARTED, state)
        )

        quote_id = (
            payment_req.metadata.get("quote_id")
            if payment_req.metadata
            else ""
        ) or ""

        resolved_payer = (
            self.payer_address
            or (self.contract_client.agent_address if self.contract_client else None)
            or "0x0000000000000000000000000000000000000000"
        )

        try:
            paid_resp = self.provider_client.paid_request_service(
                service_request=request,
                quote_id=quote_id,
                tx_hash=payment_result.transaction_hash or "0x0",
                payer_address=resolved_payer,
                endpoint_path=endpoint_path,
            )
        except AgentError as exc:
            state = self.state_manager.transition_to(
                AgentStage.DELIVERY_FAILED,
                delivery_status=DeliveryStatus.FAILED,
                error_reason=str(exc),
            )
            self.event_emitter.publish(
                AgentEvent.from_state(AgentEventType.DELIVERY_FAILED, state, error=str(exc))
            )
            raise

        if not paid_resp.is_fulfilled or paid_resp.delivery_result is None:
            state = self.state_manager.transition_to(
                AgentStage.DELIVERY_FAILED,
                delivery_status=DeliveryStatus.FAILED,
                error_reason="Provider did not deliver service after payment verification",
            )
            self.event_emitter.publish(
                AgentEvent.from_state(AgentEventType.DELIVERY_FAILED, state, error=state.error_reason)
            )
            raise DeliveryError(
                "Service delivery failed after on-chain payment",
                code="DELIVERY_VERIFICATION_FAILED",
                request_id=req_id_str,
            )

        delivery_result = paid_resp.delivery_result
        content_hash = delivery_result.content_hash or ""

        # 5. SERVICE_FULFILLED
        state = self.state_manager.transition_to(
            AgentStage.SERVICE_FULFILLED,
            delivery_status=DeliveryStatus.FULFILLED,
            content_hash=content_hash,
        )
        self.event_emitter.publish(
            AgentEvent.from_state(AgentEventType.DELIVERY_COMPLETED, state)
        )

        # 6. Record delivery proof on-chain (recordDelivery)
        if self.contract_client is not None and content_hash:
            try:
                # Ensure 32-byte format (64 hex characters)
                record_hash = content_hash if content_hash.startswith("0x") else f"0x{content_hash}"
                logger.info("Recording delivery on-chain: request_id=%s hash=%s", req_id_str, record_hash)
                self.contract_client.record_delivery(request.request_id, record_hash)
                state = self.state_manager.transition_to(AgentStage.RECEIPT_RECORDED)
                self.event_emitter.publish(
                    AgentEvent.from_state(AgentEventType.RECEIPT_RECORDED, state)
                )
            except Exception as exc:
                logger.error("Failed to record delivery on-chain: %s", exc)
                # Non-fatal to commercial delivery fulfillment, but logged and tracked
                pass

        # 7. Create commercial ServiceReceipt & COMPLETED state
        receipt = ServiceReceipt(
            request_id=request.request_id,
            provider=payment_req.provider,
            amount=payment_req.amount,
            currency=payment_req.currency,
            payment_reference=payment_result.transaction_hash or "CONFIRMED",
            content_hash=content_hash,
        )

        state = self.state_manager.transition_to(AgentStage.COMPLETED)
        self.event_emitter.publish(
            AgentEvent.from_state(AgentEventType.TASK_COMPLETED, state)
        )

        return receipt

    def get_state(self) -> AgentState:
        """Retrieve current orchestrator state."""
        return self.state_manager.get_state()
