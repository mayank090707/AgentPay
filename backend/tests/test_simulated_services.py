import json


def test_compute_service_delivery(client):
    req_payload = {"operation": "matrix_multiply", "params": {"matrix_size": 100}}
    res_402 = client.post("/services/compute", json=req_payload)
    quote_id = res_402.headers.get("X-Payment-Quote-Id")

    proof = {"quote_id": quote_id, "tx_hash": "0xcompute_tx_1001", "payer_address": "0xClient"}
    res_200 = client.post(
        "/services/compute",
        json=req_payload,
        headers={"X-Payment-Proof": json.dumps(proof)}
    )

    assert res_200.status_code == 200
    data = res_200.json()
    assert data["service_type"] == "compute"
    assert data["data"]["execution_result"]["matrix_dimensions"] == "100x100"


def test_storage_service_delivery(client):
    req_payload = {"key": "secret_doc_v1", "value": "Sensitive agent payload string for decentralized storage test."}
    res_402 = client.post("/services/storage", json=req_payload)
    quote_id = res_402.headers.get("X-Payment-Quote-Id")

    proof = {"quote_id": quote_id, "tx_hash": "0xstorage_tx_2002", "payer_address": "0xClient"}
    res_200 = client.post(
        "/services/storage",
        json=req_payload,
        headers={"X-Payment-Proof": json.dumps(proof)}
    )

    assert res_200.status_code == 200
    data = res_200.json()
    assert data["service_type"] == "storage"
    assert data["data"]["key"] == "secret_doc_v1"
    assert data["data"]["storage_location"].startswith("ipfs://")
