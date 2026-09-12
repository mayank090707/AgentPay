import json


def test_audit_logs_and_verification(client):
    # 1. 402 Request
    req_payload = {"text": "Audit trail test string", "source_lang": "en", "target_lang": "fr"}
    res_402 = client.post("/services/translate", json=req_payload)
    request_id = res_402.headers.get("X-Request-ID")
    quote_id = res_402.headers.get("X-Payment-Quote-Id")

    # 2. Query audit logs for QUOTE_CREATED
    res_audit1 = client.get(f"/audit/logs?request_id={request_id}")
    assert res_audit1.status_code == 200
    logs1 = res_audit1.json()["logs"]
    assert len(logs1) >= 1
    assert logs1[0]["event_type"] == "QUOTE_CREATED"

    # 3. Pay Quote
    proof = {"quote_id": quote_id, "tx_hash": "0xaudit_tx_4004", "payer_address": "0xA"}
    res_200 = client.post(
        "/services/translate",
        json=req_payload,
        headers={"X-Payment-Proof": json.dumps(proof)}
    )
    assert res_200.status_code == 200

    # 4. Query audit verification endpoint GET /audit/verify/{request_id}
    res_verify = client.get(f"/audit/verify/{request_id}")
    assert res_verify.status_code == 200
    verify_data = res_verify.json()
    assert verify_data["is_valid"] is True
    assert verify_data["status"] == "VERIFIED"
    assert verify_data["content_hash_matches"] is True
    assert verify_data["receipt_signature_valid"] is True
    assert len(verify_data["audit_trail"]) >= 3  # QUOTE_CREATED, PAYMENT_VERIFIED, SERVICE_DELIVERED
