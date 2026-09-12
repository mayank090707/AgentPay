import json
from backend.app.core.hashing import compute_sha256
from backend.app.core.receipt_generator import verify_receipt_signature
from backend.app.schemas.receipt import ReceiptResponse


def test_hashing_consistency():
    h1 = compute_sha256({"a": 1, "b": 2})
    h2 = compute_sha256({"b": 2, "a": 1})
    assert h1 == h2  # Key order independence


def test_receipt_generation_and_verification_endpoint(client):
    # 1. 402 Request
    req_payload = {"text": "AgentPay receipt test", "source_lang": "en", "target_lang": "es"}
    res_402 = client.post("/services/translate", json=req_payload)
    quote_id = res_402.headers.get("X-Payment-Quote-Id")
    request_id = res_402.headers.get("X-Request-ID")

    # 2. Resubmit with payment
    proof = {"quote_id": quote_id, "tx_hash": "0xreceipt_tx_3003", "payer_address": "0xClientAddress"}
    res_200 = client.post(
        "/services/translate",
        json=req_payload,
        headers={"X-Payment-Proof": json.dumps(proof)}
    )
    assert res_200.status_code == 200
    receipt_data = res_200.json()["receipt"]

    # 3. Verify receipt HMAC signature validity
    receipt_obj = ReceiptResponse(**receipt_data)
    assert verify_receipt_signature(receipt_obj) is True

    # 4. Fetch receipt via GET /receipts/{request_id}
    res_receipt = client.get(f"/receipts/{request_id}")
    assert res_receipt.status_code == 200
    assert res_receipt.json()["receipt_id"] == receipt_data["receipt_id"]
    assert res_receipt.json()["signature"] == receipt_data["signature"]
