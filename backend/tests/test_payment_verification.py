import json


def test_payment_flow_success(client):
    # 1. Initial 402 request to generate quote
    req_payload = {"text": "hello", "source_lang": "en", "target_lang": "es"}
    res_402 = client.post("/services/translate", json=req_payload)
    assert res_402.status_code == 402
    quote_id = res_402.headers.get("X-Payment-Quote-Id")

    # 2. Resubmit request with valid payment proof
    payment_proof = {
        "quote_id": quote_id,
        "tx_hash": "0xabc123456789def00112233445566778899aabbcc",
        "payer_address": "0xClientPayerAddress"
    }

    res_200 = client.post(
        "/services/translate",
        json=req_payload,
        headers={"X-Payment-Proof": json.dumps(payment_proof)}
    )

    assert res_200.status_code == 200
    data = res_200.json()
    assert data["status"] == "success"
    assert data["data"]["translated_text"] == "hola"
    assert "content_hash" in data
    assert "receipt" in data
    assert data["receipt"]["tx_hash"] == payment_proof["tx_hash"]


def test_double_spending_replay_rejected(client):
    # 1. Generate Quote A
    res_a = client.post("/services/translate", json={"text": "hello", "source_lang": "en", "target_lang": "fr"})
    quote_id_a = res_a.headers.get("X-Payment-Quote-Id")

    # 2. Pay Quote A
    tx_hash = "0xunique_tx_hash_99999"
    proof_a = {"quote_id": quote_id_a, "tx_hash": tx_hash, "payer_address": "0xA"}
    res_pay_a = client.post(
        "/services/translate",
        json={"text": "hello", "source_lang": "en", "target_lang": "fr"},
        headers={"X-Payment-Proof": json.dumps(proof_a)}
    )
    assert res_pay_a.status_code == 200

    # 3. Generate Quote B
    res_b = client.post("/services/translate", json={"text": "hello", "source_lang": "en", "target_lang": "de"})
    quote_id_b = res_b.headers.get("X-Payment-Quote-Id")

    # 4. Attempt to RE-USE same tx_hash for Quote B -> Double spending rejection
    proof_b = {"quote_id": quote_id_b, "tx_hash": tx_hash, "payer_address": "0xB"}
    res_pay_b = client.post(
        "/services/translate",
        json={"text": "hello", "source_lang": "en", "target_lang": "de"},
        headers={"X-Payment-Proof": json.dumps(proof_b)}
    )

    assert res_pay_b.status_code == 400
    assert "Double-spending" in res_pay_b.json()["detail"]


def test_invalid_quote_id_rejected(client):
    proof = {"quote_id": "non_existent_quote_id", "tx_hash": "0x123", "payer_address": "0xA"}
    response = client.post(
        "/services/translate",
        json={"text": "hello"},
        headers={"X-Payment-Proof": json.dumps(proof)}
    )
    assert response.status_code == 400
    assert "not found" in response.json()["detail"]
