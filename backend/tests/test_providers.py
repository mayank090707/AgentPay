import json
import pytest
from backend.app.config import settings
from backend.app.core.provider_registry import PROVIDER_REGISTRY
from backend.app.core.receipt_generator import verify_receipt_signature
from backend.app.schemas.receipt import ReceiptResponse


def test_list_providers(client):
    """
    GET /providers should return all registered providers with their pricing schemas.
    """
    response = client.get("/providers")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 8
    provider_ids = [p["provider_id"] for p in data["providers"]]
    assert "alpha" in provider_ids
    assert "beta" in provider_ids

    # Verify provider details
    alpha = next(p for p in data["providers"] if p["provider_id"] == "alpha")
    assert alpha["name"] == "Alpha AI"
    assert alpha["wallet_address"] == PROVIDER_REGISTRY["alpha"].wallet_address
    assert alpha["services"]["translation"]["price_per_unit"] == 0.00010

    beta = next(p for p in data["providers"] if p["provider_id"] == "beta")
    assert beta["name"] == "Beta Cloud"
    assert beta["wallet_address"] == PROVIDER_REGISTRY["beta"].wallet_address
    assert beta["services"]["translation"]["price_per_unit"] == 0.00002


def test_compare_providers_translation(client):
    """
    GET /providers/compare/translation should sort providers cheapest first.
    Beta (0.00002/100 chars) is cheaper than Alpha (0.00010/100 chars).
    """
    test_text = "Hello world! This is a test text for price comparison."  # < 100 chars -> 1 unit
    response = client.get(f"/providers/compare/translation?text={test_text}")
    assert response.status_code == 200
    data = response.json()
    assert data["service_type"] == "translation"
    assert len(data["providers"]) == 8

    # Lowest priced provider (0.00002 ETH) should be first
    assert data["providers"][0]["calculated_price"] == 0.00002
    assert data["providers"][0]["provider_id"] in ["beta", "prov_trans_01"]


def test_compare_providers_storage(client):
    """
    GET /providers/compare/storage:
    Storage providers are sorted cheapest first.
    """
    response = client.get("/providers/compare/storage?value=some_test_data_to_store")
    assert response.status_code == 200
    data = response.json()
    assert data["service_type"] == "storage"
    assert len(data["providers"]) == 8

    # Verify cheapest prices come first
    prices = [p["calculated_price"] for p in data["providers"]]
    assert prices == sorted(prices)


def test_compare_providers_unsupported_service(client):
    """
    GET /providers/compare/{unsupported} should return 400 Bad Request.
    """
    response = client.get("/providers/compare/video_rendering")
    assert response.status_code == 400
    assert "Unsupported service type" in response.json()["detail"]


def test_service_request_with_specific_provider_quote(client):
    """
    POST /services/translate with provider_id="beta" should return a 402 challenge
    configured with Beta's wallet address and Beta's pricing.
    """
    payload = {
        "text": "Hello world from autonomous AI agent",
        "source_lang": "en",
        "target_lang": "es",
        "provider_id": "beta"
    }
    response = client.get if False else client.post("/services/translate", json=payload)
    assert response.status_code == 402

    # Headers check
    beta_wallet = PROVIDER_REGISTRY["beta"].wallet_address
    assert response.headers["X-Payment-Address"] == beta_wallet
    assert float(response.headers["X-Payment-Amount"]) == 0.00002

    # Body check
    data = response.json()
    assert data["pay_to_address"] == beta_wallet
    assert data["amount"] == 0.00002


def test_service_request_with_alpha_provider_quote(client):
    """
    POST /services/translate with provider_id="alpha" should return a 402 challenge
    configured with Alpha's wallet address and Alpha's pricing.
    """
    payload = {
        "text": "Hello world from autonomous AI agent",
        "source_lang": "en",
        "target_lang": "es",
        "provider_id": "alpha"
    }
    response = client.post("/services/translate", json=payload)
    assert response.status_code == 402

    alpha_wallet = PROVIDER_REGISTRY["alpha"].wallet_address
    assert response.headers["X-Payment-Address"] == alpha_wallet
    assert float(response.headers["X-Payment-Amount"]) == 0.00010

    data = response.json()
    assert data["pay_to_address"] == alpha_wallet
    assert data["amount"] == 0.00010


def test_service_request_unknown_provider_404(client):
    """
    POST /services/translate with unknown provider_id should return 404.
    """
    payload = {
        "text": "Hello world",
        "source_lang": "en",
        "target_lang": "es",
        "provider_id": "gamma_unknown"
    }
    response = client.post("/services/translate", json=payload)
    assert response.status_code == 404
    assert "Provider 'gamma_unknown' not found" in response.json()["detail"]


def test_service_request_without_provider_id_uses_default(client):
    """
    POST /services/translate without provider_id preserves backward compatibility,
    using settings.PROVIDER_WALLET_ADDRESS and catalog pricing.
    """
    payload = {
        "text": "Hello backward compatibility",
        "source_lang": "en",
        "target_lang": "fr"
    }
    response = client.post("/services/translate", json=payload)
    assert response.status_code == 402
    assert response.headers["X-Payment-Address"] == settings.PROVIDER_WALLET_ADDRESS
    data = response.json()
    assert data["pay_to_address"] == settings.PROVIDER_WALLET_ADDRESS


def test_full_flow_with_selected_provider_and_receipt_verification(client):
    """
    End-to-end flow with selected provider:
    1. Issue 402 Quote for provider "beta".
    2. Pay on-chain and resubmit with X-Payment-Proof.
    3. Verify service delivered successfully (200 OK).
    4. Verify receipt has beta provider's wallet address.
    5. Verify receipt HMAC signature matches.
    6. Verify GET /receipts/{request_id} returns matching provider address.
    7. Verify GET /audit/verify/{request_id} cryptographically validates the full trail.
    """
    # 1. Initial 402 Request
    req_payload = {
        "text": "Autonomous Agent Payment Test",
        "source_lang": "en",
        "target_lang": "de",
        "provider_id": "beta"
    }
    res_402 = client.post("/services/translate", json=req_payload)
    assert res_402.status_code == 402
    quote_id = res_402.headers.get("X-Payment-Quote-Id")
    request_id = res_402.headers.get("X-Request-ID")
    beta_wallet = PROVIDER_REGISTRY["beta"].wallet_address
    assert res_402.headers.get("X-Payment-Address") == beta_wallet

    # 2. Resubmit with payment proof
    payment_proof = {
        "quote_id": quote_id,
        "tx_hash": "0xprovider_beta_tx_12345",
        "payer_address": "0xAgentClientWallet"
    }
    res_200 = client.post(
        "/services/translate",
        json=req_payload,
        headers={"X-Payment-Proof": json.dumps(payment_proof)}
    )
    assert res_200.status_code == 200
    delivery_data = res_200.json()
    assert delivery_data["status"] == "success"
    assert delivery_data["request_id"] == request_id

    # 3. Verify receipt fields
    receipt = delivery_data["receipt"]
    assert receipt["provider_address"] == beta_wallet
    assert receipt["amount"] == 0.00002

    # 4. Verify HMAC signature using ReceiptResponse
    receipt_obj = ReceiptResponse(**receipt)
    assert verify_receipt_signature(receipt_obj) is True

    # 5. Verify GET /receipts/{request_id}
    res_receipt = client.get(f"/receipts/{request_id}")
    assert res_receipt.status_code == 200
    fetched_receipt = res_receipt.json()
    assert fetched_receipt["provider_address"] == beta_wallet
    assert fetched_receipt["signature"] == receipt["signature"]

    # 6. Verify audit trail integrity via /audit/verify/{request_id}
    res_audit = client.get(f"/audit/verify/{request_id}")
    assert res_audit.status_code == 200
    audit_data = res_audit.json()
    assert audit_data["is_valid"] is True
    assert audit_data["receipt_signature_valid"] is True
    assert audit_data["content_hash_matches"] is True
