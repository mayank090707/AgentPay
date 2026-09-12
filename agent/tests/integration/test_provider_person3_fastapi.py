"""
Integration tests validating ProviderClient against Person 3's actual FastAPI application.
"""

from decimal import Decimal
import json
import httpx
import pytest

from fastapi.testclient import TestClient
from backend.app.main import app
from agent.src.models import RequestId, ServiceRequest
from agent.src.provider_client import ProviderClient


@pytest.fixture
def provider_test_client() -> ProviderClient:
    """Instantiate ProviderClient backed by Person 3 FastAPI TestClient."""
    http_client = TestClient(app, base_url="http://testserver")
    return ProviderClient(base_url="http://testserver", http_client=http_client)


def test_real_fastapi_translate_402_handshake(provider_test_client: ProviderClient) -> None:
    """Verify Person 3 translation endpoint returns valid HTTP 402 in ETH."""
    req_id = RequestId.generate()
    service_req = ServiceRequest(
        request_id=req_id,
        service="translation",
        payload={"text": "Hello world from integration test", "source_lang": "en", "target_lang": "es"},
    )

    resp = provider_test_client.request_service(
        service_request=service_req,
        endpoint_path="/services/translate",
    )

    assert resp.is_payment_required
    assert resp.payment_requirement is not None

    req = resp.payment_requirement
    assert req.request_id == req_id
    assert req.currency == "ETH"
    assert req.amount > 0
    assert req.payment_address.startswith("0x")
    assert req.metadata is not None
    assert "quote_id" in req.metadata


def test_real_fastapi_paid_retry_flow(provider_test_client: ProviderClient) -> None:
    """Verify Person 3 delivers service upon receiving X-Payment-Proof and X-Request-ID."""
    req_id = RequestId.generate()
    service_req = ServiceRequest(
        request_id=req_id,
        service="translation",
        payload={"text": "AgentPay is an autonomous payment framework", "source_lang": "en", "target_lang": "fr"},
    )

    # 1. Unpaid request -> 402
    resp_402 = provider_test_client.request_service(
        service_request=service_req,
        endpoint_path="/services/translate",
    )
    assert resp_402.is_payment_required
    quote_id = resp_402.payment_requirement.metadata["quote_id"]
    simulated_tx_hash = "0x" + "bb" * 32
    payer_wallet = "0x" + "cc" * 20

    # 2. Paid request -> 200
    resp_paid = provider_test_client.paid_request_service(
        service_request=service_req,
        quote_id=quote_id,
        tx_hash=simulated_tx_hash,
        payer_address=payer_wallet,
        endpoint_path="/services/translate",
    )

    assert resp_paid.is_fulfilled
    assert resp_paid.delivery_result is not None

    delivery = resp_paid.delivery_result
    assert delivery.request_id == req_id
    assert delivery.content_hash is not None
    assert len(delivery.content_hash) == 64  # SHA-256 hex string

    # 3. Idempotent replay: retrying with same request_id returns identical delivery
    resp_replay = provider_test_client.paid_request_service(
        service_request=service_req,
        quote_id=quote_id,
        tx_hash=simulated_tx_hash,
        payer_address=payer_wallet,
        endpoint_path="/services/translate",
    )
    assert resp_replay.is_fulfilled
    assert resp_replay.delivery_result.content_hash == delivery.content_hash
