"""
Provider client boundary for Person 2 (AI Agent + Payment).

Implements communication with external service providers, explicit HTTP 402 modeling,
and strict RequestId preservation.

PHASE 2A ARCHITECTURAL BOUNDARIES:
- Person 3's provider API contract has not been supplied yet.
- Zero hardcoded routes (/translate, /compute, etc.) or endpoint assumptions.
- endpoint_path is explicit and required; automatic path synthesis from service name is prohibited.
- HTTP 402 is modeled as an expected commercial protocol condition, NOT a generic failure.
- Invariant: ProviderResponse represents exactly one successful outcome (fulfilled OR payment required).
- Invariant: Returned request_id must match the initiating request_id.
- Zero Web3, blockchain, payment execution, or LLM integrations.
"""

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Optional

import httpx

from agent.src.config import get_settings
from agent.src.exceptions import (
    ConfigurationError,
    DeliveryError,
    InvalidPaymentRequirementError,
    ProviderError,
)
from agent.src.models import (
    DeliveryResult,
    DeliveryStatus,
    PaymentRequirement,
    RequestId,
    ServiceRequest,
)


@dataclass(frozen=True)
class ProviderResponse:
    """
    Explicit typed representation of a provider response.

    INVARIANT:
    Must represent exactly ONE condition:
    - fulfilled response (delivery_result is set, payment_requirement is None)
    OR
    - payment required response (payment_requirement is set, delivery_result is None)
    Must never contain both or neither.
    """

    status_code: int
    delivery_result: Optional[DeliveryResult] = None
    payment_requirement: Optional[PaymentRequirement] = None

    def __post_init__(self) -> None:
        has_delivery = self.delivery_result is not None
        has_payment = self.payment_requirement is not None

        if has_delivery and has_payment:
            raise ValueError(
                "ProviderResponse invariant violated: cannot contain both delivery_result and payment_requirement"
            )
        if not has_delivery and not has_payment:
            raise ValueError(
                "ProviderResponse invariant violated: must contain either delivery_result or payment_requirement"
            )

    @property
    def is_fulfilled(self) -> bool:
        """True if the service was delivered successfully without prior payment."""
        return self.delivery_result is not None

    @property
    def is_payment_required(self) -> bool:
        """True if the provider returned HTTP 402 Payment Required."""
        return self.payment_requirement is not None


class ProviderClient:
    """
    Client abstraction for submitting service requests to external providers.
    Supports dependency-injected HTTP transport for deterministic testing without real network calls.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        http_client: Optional[httpx.Client] = None,
        timeout: float = 30.0,
    ) -> None:
        settings = get_settings()
        self.base_url = (base_url or settings.PROVIDER_BASE_URL or "").rstrip("/")
        self._http_client = http_client
        self.timeout = timeout

    def request_service(
        self,
        service_request: ServiceRequest,
        endpoint_path: Optional[str] = None,
    ) -> ProviderResponse:
        """
        Submit a ServiceRequest to the provider.

        ARCHITECTURAL RULES:
        - endpoint_path must be explicitly provided. Automatic routing from service name is forbidden.
        - Returned request_id is strictly validated against service_request.request_id.
        - HTTP 402 is parsed into a domain PaymentRequirement.
        - HTTP 2xx is mapped into a DeliveryResult.
        - Provider/network errors are mapped into ProviderError without leaking raw HTTP exceptions.
        """
        req_id_str = str(service_request.request_id)

        # Rule 1: Explicit endpoint routing requirement
        if not endpoint_path or not endpoint_path.strip():
            raise ConfigurationError(
                "Provider endpoint_path must be explicitly provided; automatic path routing from service name is not permitted",
                code="MISSING_ENDPOINT_PATH",
                details={"service": service_request.service, "request_id": req_id_str},
            )

        if not self.base_url:
            raise ConfigurationError(
                "Provider base_url is not configured",
                code="MISSING_PROVIDER_URL",
                details={"request_id": req_id_str},
            )

        clean_base = self.base_url.rstrip("/")
        clean_path = endpoint_path.strip().lstrip("/")
        target_url = f"{clean_base}/{clean_path}"

        payload: dict[str, Any] = {
            "request_id": req_id_str,
            "service": service_request.service,
            "payload": service_request.payload,
        }
        if service_request.parameters:
            payload["parameters"] = service_request.parameters

        headers = {
            "Content-Type": "application/json",
            "X-Request-ID": req_id_str,
        }

        try:
            if self._http_client is not None:
                response = self._http_client.post(
                    target_url,
                    json=payload,
                    headers=headers,
                    timeout=self.timeout,
                )
            else:
                with httpx.Client(timeout=self.timeout) as client:
                    response = client.post(
                        target_url,
                        json=payload,
                        headers=headers,
                    )
        except httpx.RequestError as exc:
            raise ProviderError(
                f"Provider communication failed: {str(exc)}",
                code="NETWORK_ERROR",
                request_id=req_id_str,
                details={"target_url": target_url, "error_type": exc.__class__.__name__},
            ) from exc

        return self._process_response(response, service_request)

    def _process_response(
        self,
        response: httpx.Response,
        service_request: ServiceRequest,
    ) -> ProviderResponse:
        """Process and map provider HTTP response into typed ProviderResponse."""
        req_id_str = str(service_request.request_id)
        status = response.status_code

        # 1. HTTP 2xx: Successful fulfillment
        if 200 <= status < 300:
            return self._handle_success_response(response, service_request)

        # 2. HTTP 402: Payment Required
        if status == 402:
            return self._handle_402_response(response, service_request)

        # 3. All other status codes: ProviderError
        raise ProviderError(
            f"Provider returned error status {status}: {response.text}",
            code=f"HTTP_{status}",
            request_id=req_id_str,
            details={"status_code": status, "body": response.text},
        )

    def _handle_success_response(
        self,
        response: httpx.Response,
        service_request: ServiceRequest,
    ) -> ProviderResponse:
        """Handle 2xx success response and enforce request_id invariant."""
        req_id_str = str(service_request.request_id)

        try:
            data = response.json()
        except Exception:
            data = {"raw_content": response.text}

        # Rule 2: If response contains request_id, validate match
        if isinstance(data, dict) and "request_id" in data:
            returned_id = str(data["request_id"]).strip().lower()
            if returned_id != req_id_str.lower():
                raise DeliveryError(
                    f"Provider returned mismatched request_id '{data['request_id']}' (expected '{req_id_str}')",
                    code="REQUEST_ID_MISMATCH",
                    request_id=req_id_str,
                    details={"returned_request_id": data["request_id"]},
                )

        content_hash = data.get("content_hash") if isinstance(data, dict) else None

        delivery = DeliveryResult(
            request_id=service_request.request_id,
            delivery_status=DeliveryStatus.FULFILLED,
            result=data,
            content_hash=content_hash,
        )

        return ProviderResponse(
            status_code=response.status_code,
            delivery_result=delivery,
        )

    def _handle_402_response(
        self,
        response: httpx.Response,
        service_request: ServiceRequest,
    ) -> ProviderResponse:
        """Handle HTTP 402 response, parse PaymentRequirement, and enforce invariants."""
        req_id_str = str(service_request.request_id)

        try:
            data = response.json()
        except Exception as exc:
            raise InvalidPaymentRequirementError(
                f"HTTP 402 response is not valid JSON: {response.text}",
                code="MALFORMED_402_RESPONSE",
                request_id=req_id_str,
                details={"raw_body": response.text},
            ) from exc

        if not isinstance(data, dict):
            raise InvalidPaymentRequirementError(
                "HTTP 402 response body must be a JSON object",
                code="MALFORMED_402_RESPONSE",
                request_id=req_id_str,
            )

        # Rule 2: Validate request_id in 402 response
        returned_id = data.get("request_id")
        if not returned_id:
            raise InvalidPaymentRequirementError(
                "HTTP 402 response missing required 'request_id'",
                code="MISSING_PAYMENT_FIELD",
                request_id=req_id_str,
            )

        if not RequestId.is_valid(returned_id) or str(returned_id).strip().lower() != req_id_str.lower():
            raise InvalidPaymentRequirementError(
                f"Provider returned mismatched or invalid request_id '{returned_id}' (expected '{req_id_str}')",
                code="REQUEST_ID_MISMATCH",
                request_id=req_id_str,
                details={"returned_request_id": returned_id},
            )

        # Validate required payment fields
        required_fields = ["amount", "currency", "provider", "payment_address"]
        for field in required_fields:
            if field not in data or data[field] is None or str(data[field]).strip() == "":
                raise InvalidPaymentRequirementError(
                    f"HTTP 402 response missing required payment field '{field}'",
                    code="MISSING_PAYMENT_FIELD",
                    request_id=req_id_str,
                    details={"missing_field": field},
                )

        # Parse and validate amount
        try:
            amount = Decimal(str(data["amount"]))
            if amount <= 0:
                raise ValueError("Amount must be greater than zero")
        except (InvalidOperation, ValueError) as exc:
            raise InvalidPaymentRequirementError(
                f"Invalid payment amount in 402 response: '{data.get('amount')}'",
                code="INVALID_AMOUNT",
                request_id=req_id_str,
                details={"amount_raw": data.get("amount")},
            ) from exc

        payment_req = PaymentRequirement(
            request_id=service_request.request_id,
            amount=amount,
            currency=str(data["currency"]).strip(),
            provider=str(data["provider"]).strip(),
            payment_address=str(data["payment_address"]).strip(),
            network=str(data["network"]).strip() if data.get("network") else None,
            metadata=data.get("metadata") if isinstance(data.get("metadata"), dict) else None,
        )

        return ProviderResponse(
            status_code=402,
            payment_requirement=payment_req,
        )
