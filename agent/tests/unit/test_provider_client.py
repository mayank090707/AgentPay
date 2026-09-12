"""Unit tests for ProviderClient and ProviderResponse."""

from decimal import Decimal

import httpx
import pytest

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
from agent.src.provider_client import ProviderClient, ProviderResponse


def test_provider_response_invariants() -> None:
    """Verify ProviderResponse enforces exactly one outcome (fulfilled OR payment required)."""
    req_id = RequestId.generate()
    delivery = DeliveryResult(
        request_id=req_id,
        delivery_status=DeliveryStatus.FULFILLED,
        result={"data": "ok"},
    )
    payment_req = PaymentRequirement(
        request_id=req_id,
        amount=Decimal("1.0"),
        currency="USDC",
        provider="p1",
        payment_address="0x" + "11" * 20,
    )

    # Valid fulfilled
    resp_fulfilled = ProviderResponse(status_code=200, delivery_result=delivery)
    assert resp_fulfilled.is_fulfilled
    assert not resp_fulfilled.is_payment_required

    # Valid payment required
    resp_payment = ProviderResponse(status_code=402, payment_requirement=payment_req)
    assert resp_payment.is_payment_required
    assert not resp_payment.is_fulfilled

    # Both set -> Invariant violated
    with pytest.raises(ValueError, match="cannot contain both"):
        ProviderResponse(
            status_code=200,
            delivery_result=delivery,
            payment_requirement=payment_req,
        )

    # Neither set -> Invariant violated
    with pytest.raises(ValueError, match="must contain either"):
        ProviderResponse(status_code=200)


def test_missing_endpoint_path_rejected() -> None:
    """Verify missing or empty endpoint_path is strictly rejected with ConfigurationError."""
    client = ProviderClient(base_url="https://api.provider.test")
    req = ServiceRequest(service="any-service", payload={"x": 1})

    with pytest.raises(ConfigurationError) as exc_info:
        client.request_service(req)
    assert exc_info.value.code == "MISSING_ENDPOINT_PATH"

    with pytest.raises(ConfigurationError) as exc_info:
        client.request_service(req, endpoint_path="   ")
    assert exc_info.value.code == "MISSING_ENDPOINT_PATH"


def test_missing_base_url_rejected() -> None:
    """Verify missing base_url raises ConfigurationError."""
    client = ProviderClient(base_url="")
    req = ServiceRequest(service="any-service", payload={"x": 1})

    with pytest.raises(ConfigurationError) as exc_info:
        client.request_service(req, endpoint_path="run")
    assert exc_info.value.code == "MISSING_PROVIDER_URL"


def test_successful_fulfillment_200_without_response_request_id() -> None:
    """Verify 200 response without explicit request_id preserves initiating request_id."""
    req = ServiceRequest(service="compute", payload={"input": "test"})

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code=200,
            json={"output": "result-123", "content_hash": "0x" + "aa" * 32},
        )

    transport = httpx.MockTransport(handler)
    http_client = httpx.Client(transport=transport)
    client = ProviderClient(base_url="https://api.provider.test", http_client=http_client)

    resp = client.request_service(req, endpoint_path="v1/compute")
    assert resp.is_fulfilled
    assert resp.delivery_result is not None
    assert resp.delivery_result.request_id == req.request_id
    assert resp.delivery_result.delivery_status == DeliveryStatus.FULFILLED
    assert resp.delivery_result.result == {
        "output": "result-123",
        "content_hash": "0x" + "aa" * 32,
    }
    assert resp.delivery_result.content_hash == "0x" + "aa" * 32


def test_successful_fulfillment_200_with_matching_request_id() -> None:
    """Verify 200 response with matching request_id succeeds cleanly."""
    req = ServiceRequest(service="compute", payload={"input": "test"})

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code=200,
            json={"request_id": str(req.request_id), "status": "done"},
        )

    transport = httpx.MockTransport(handler)
    http_client = httpx.Client(transport=transport)
    client = ProviderClient(base_url="https://api.provider.test", http_client=http_client)

    resp = client.request_service(req, endpoint_path="v1/compute")
    assert resp.is_fulfilled
    assert resp.delivery_result is not None
    assert resp.delivery_result.request_id == req.request_id


def test_successful_fulfillment_200_with_mismatched_request_id() -> None:
    """Verify 200 response with mismatched request_id raises DeliveryError."""
    req = ServiceRequest(service="compute", payload={"input": "test"})
    different_id = str(RequestId.generate())

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code=200,
            json={"request_id": different_id, "status": "done"},
        )

    transport = httpx.MockTransport(handler)
    http_client = httpx.Client(transport=transport)
    client = ProviderClient(base_url="https://api.provider.test", http_client=http_client)

    with pytest.raises(DeliveryError) as exc_info:
        client.request_service(req, endpoint_path="v1/compute")
    assert exc_info.value.code == "REQUEST_ID_MISMATCH"


def test_http_402_valid_payment_requirement() -> None:
    """Verify HTTP 402 response is parsed into domain PaymentRequirement."""
    req = ServiceRequest(service="ai-inference", payload={"prompt": "hello"})

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code=402,
            json={
                "request_id": str(req.request_id),
                "amount": "0.25",
                "currency": "USDC",
                "provider": "inference-node-1",
                "payment_address": "0x" + "22" * 20,
                "network": "sepolia",
                "metadata": {"rate_limit": 100},
            },
        )

    transport = httpx.MockTransport(handler)
    http_client = httpx.Client(transport=transport)
    client = ProviderClient(base_url="https://api.provider.test", http_client=http_client)

    resp = client.request_service(req, endpoint_path="execute")
    assert resp.is_payment_required
    assert not resp.is_fulfilled
    assert resp.payment_requirement is not None

    payment_req = resp.payment_requirement
    assert payment_req.request_id == req.request_id
    assert payment_req.amount == Decimal("0.25")
    assert payment_req.currency == "USDC"
    assert payment_req.provider == "inference-node-1"
    assert payment_req.payment_address == "0x" + "22" * 20
    assert payment_req.network == "sepolia"
    assert payment_req.metadata == {"rate_limit": 100}


def test_http_402_missing_request_id() -> None:
    """Verify HTTP 402 response missing request_id raises InvalidPaymentRequirementError."""
    req = ServiceRequest(service="ai", payload={})

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code=402,
            json={
                "amount": "1.0",
                "currency": "USDC",
                "provider": "p1",
                "payment_address": "0x" + "11" * 20,
            },
        )

    transport = httpx.MockTransport(handler)
    http_client = httpx.Client(transport=transport)
    client = ProviderClient(base_url="https://api.provider.test", http_client=http_client)

    with pytest.raises(InvalidPaymentRequirementError) as exc_info:
        client.request_service(req, endpoint_path="task")
    assert exc_info.value.code == "MISSING_PAYMENT_FIELD"


def test_http_402_mismatched_request_id() -> None:
    """Verify HTTP 402 response with mismatched request_id raises InvalidPaymentRequirementError."""
    req = ServiceRequest(service="ai", payload={})
    other_id = str(RequestId.generate())

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code=402,
            json={
                "request_id": other_id,
                "amount": "1.0",
                "currency": "USDC",
                "provider": "p1",
                "payment_address": "0x" + "11" * 20,
            },
        )

    transport = httpx.MockTransport(handler)
    http_client = httpx.Client(transport=transport)
    client = ProviderClient(base_url="https://api.provider.test", http_client=http_client)

    with pytest.raises(InvalidPaymentRequirementError) as exc_info:
        client.request_service(req, endpoint_path="task")
    assert exc_info.value.code == "REQUEST_ID_MISMATCH"


def test_http_402_missing_required_fields() -> None:
    """Verify HTTP 402 response missing required fields raises InvalidPaymentRequirementError."""
    req = ServiceRequest(service="ai", payload={})

    # Missing payment_address
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code=402,
            json={
                "request_id": str(req.request_id),
                "amount": "1.0",
                "currency": "USDC",
                "provider": "p1",
            },
        )

    transport = httpx.MockTransport(handler)
    http_client = httpx.Client(transport=transport)
    client = ProviderClient(base_url="https://api.provider.test", http_client=http_client)

    with pytest.raises(InvalidPaymentRequirementError) as exc_info:
        client.request_service(req, endpoint_path="task")
    assert exc_info.value.code == "MISSING_PAYMENT_FIELD"


def test_http_402_malformed_amount() -> None:
    """Verify invalid or non-positive amount in 402 raises InvalidPaymentRequirementError."""
    req = ServiceRequest(service="ai", payload={})

    for bad_amount in ["0", "-0.50", "abc", ""]:
        def handler(request: httpx.Request, a: str = bad_amount) -> httpx.Response:
            return httpx.Response(
                status_code=402,
                json={
                    "request_id": str(req.request_id),
                    "amount": a,
                    "currency": "USDC",
                    "provider": "p1",
                    "payment_address": "0x" + "11" * 20,
                },
            )

        transport = httpx.MockTransport(handler)
        http_client = httpx.Client(transport=transport)
        client = ProviderClient(base_url="https://api.provider.test", http_client=http_client)

        with pytest.raises(InvalidPaymentRequirementError) as exc_info:
            client.request_service(req, endpoint_path="task")
        assert exc_info.value.code in ("INVALID_AMOUNT", "MISSING_PAYMENT_FIELD")


def test_http_402_non_json_body() -> None:
    """Verify non-JSON 402 response raises InvalidPaymentRequirementError."""
    req = ServiceRequest(service="ai", payload={})

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code=402, text="Payment Required - Not JSON")

    transport = httpx.MockTransport(handler)
    http_client = httpx.Client(transport=transport)
    client = ProviderClient(base_url="https://api.provider.test", http_client=http_client)

    with pytest.raises(InvalidPaymentRequirementError) as exc_info:
        client.request_service(req, endpoint_path="task")
    assert exc_info.value.code == "MALFORMED_402_RESPONSE"


def test_provider_http_errors_500_and_404() -> None:
    """Verify 5xx and 4xx status codes are mapped to ProviderError."""
    req = ServiceRequest(service="ai", payload={})

    for code in [500, 502, 404, 403]:
        def handler(request: httpx.Request, sc: int = code) -> httpx.Response:
            return httpx.Response(status_code=sc, text=f"Error {sc}")

        transport = httpx.MockTransport(handler)
        http_client = httpx.Client(transport=transport)
        client = ProviderClient(base_url="https://api.provider.test", http_client=http_client)

        with pytest.raises(ProviderError) as exc_info:
            client.request_service(req, endpoint_path="task")
        assert exc_info.value.code == f"HTTP_{code}"
        assert exc_info.value.request_id == str(req.request_id)


def test_network_and_timeout_errors_mapped() -> None:
    """Verify transport errors (network, timeout) map cleanly to ProviderError."""
    req = ServiceRequest(service="ai", payload={})

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("Connection timed out")

    transport = httpx.MockTransport(handler)
    http_client = httpx.Client(transport=transport)
    client = ProviderClient(base_url="https://api.provider.test", http_client=http_client)

    with pytest.raises(ProviderError) as exc_info:
        client.request_service(req, endpoint_path="task")
    assert exc_info.value.code == "NETWORK_ERROR"
    assert exc_info.value.request_id == str(req.request_id)
