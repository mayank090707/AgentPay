import json


def test_translation_402_payment_required(client):
    # Send translation request without payment header
    payload = {"text": "Hello, world!", "source_lang": "en", "target_lang": "es"}
    response = client.post("/services/translate", json=payload)

    # Verify HTTP 402 status code
    assert response.status_code == 402

    # Verify Response Headers
    assert response.headers.get("X-Payment-Required") == "true"
    assert "X-Payment-Quote-Id" in response.headers
    assert "X-Payment-Amount" in response.headers
    assert "X-Payment-Address" in response.headers
    assert "X-Request-ID" in response.headers

    # Verify JSON Payload
    data = response.json()
    assert data["error"] == "Payment Required"
    assert data["service_type"] == "translation"
    assert data["amount"] > 0
    assert data["quote_id"] == response.headers.get("X-Payment-Quote-Id")


def test_compute_402_payment_required(client):
    payload = {"operation": "matrix_multiply", "params": {"matrix_size": 100}}
    response = client.post("/services/compute", json=payload)

    assert response.status_code == 402
    assert response.headers.get("X-Payment-Required") == "true"
    data = response.json()
    assert data["amount"] == 0.0012


def test_storage_402_payment_required(client):
    payload = {"key": "test_doc", "value": "AgentPay decentralized storage demo payload."}
    response = client.post("/services/storage", json=payload)

    assert response.status_code == 402
    data = response.json()
    assert data["service_type"] == "storage"
