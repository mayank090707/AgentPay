import json
from datetime import datetime, timedelta
import pytest
from backend.app.models.quote import Quote, QuoteStatus
from backend.app.models.payment import Payment
from backend.app.models.delivery import Delivery
from backend.app.models.audit import AuditLog
from backend.app.core.receipt_generator import verify_receipt_signature
from backend.app.schemas.receipt import ReceiptResponse


def test_a_agent_supplied_x_request_id(client):
    """
    Test A: Accept agent-supplied X-Request-ID on translate/compute/storage.
    Verifies that the supplied request ID is used in the 402 challenge header and body.
    """
    custom_request_id = "agent_custom_req_9988776655"
    
    # 1. Translate
    res_translate = client.post(
        "/services/translate",
        json={"text": "Hello world", "source_lang": "en", "target_lang": "es"},
        headers={"X-Request-ID": custom_request_id}
    )
    assert res_translate.status_code == 402
    assert res_translate.headers["X-Request-ID"] == custom_request_id
    assert res_translate.json()["request_id"] == custom_request_id

    # 2. Compute
    compute_req_id = "compute_req_11223344"
    res_compute = client.post(
        "/services/compute",
        json={"operation": "matrix_multiply", "params": {"matrix_size": 20}},
        headers={"X-Request-ID": compute_req_id}
    )
    assert res_compute.status_code == 402
    assert res_compute.headers["X-Request-ID"] == compute_req_id
    assert res_compute.json()["request_id"] == compute_req_id

    # 3. Storage
    storage_req_id = "storage_req_aabbccdd"
    res_storage = client.post(
        "/services/storage",
        json={"key": "test_key", "value": "test_val"},
        headers={"X-Request-ID": storage_req_id}
    )
    assert res_storage.status_code == 402
    assert res_storage.headers["X-Request-ID"] == storage_req_id
    assert res_storage.json()["request_id"] == storage_req_id


def test_b_request_id_at_least_66_characters(client, db_session):
    """
    Test B: Support request IDs of at least 66 characters;
    verify request_id is stored and retrieved across Quote, Payment, Delivery, and AuditLog without truncation.
    """
    # 70-character request ID
    long_request_id = "0x" + ("ab" * 32) + "_long_suffix_for_full_length_test"
    assert len(long_request_id) >= 66

    payload = {"text": "AgentPay length test", "source_lang": "en", "target_lang": "de"}
    res_402 = client.post(
        "/services/translate",
        json=payload,
        headers={"X-Request-ID": long_request_id}
    )
    assert res_402.status_code == 402
    quote_id = res_402.headers["X-Payment-Quote-Id"]
    assert res_402.headers["X-Request-ID"] == long_request_id

    # Verify Quote table
    q = db_session.query(Quote).filter(Quote.id == quote_id).first()
    assert q is not None
    assert q.request_id == long_request_id

    # Pay and deliver
    proof = {"quote_id": quote_id, "tx_hash": "0xlong_id_tx_1001", "payer_address": "0xPayer1001"}
    res_200 = client.post(
        "/services/translate",
        json=payload,
        headers={"X-Payment-Proof": json.dumps(proof), "X-Request-ID": long_request_id}
    )
    assert res_200.status_code == 200
    assert res_200.json()["request_id"] == long_request_id

    # Verify Payment table
    p = db_session.query(Payment).filter(Payment.request_id == long_request_id).first()
    assert p is not None
    assert p.request_id == long_request_id

    # Verify Delivery table
    d = db_session.query(Delivery).filter(Delivery.request_id == long_request_id).first()
    assert d is not None
    assert d.request_id == long_request_id

    # Verify AuditLog table
    audit_logs = db_session.query(AuditLog).filter(AuditLog.request_id == long_request_id).all()
    assert len(audit_logs) >= 2
    for log in audit_logs:
        assert log.request_id == long_request_id


def test_c_same_request_id_same_payload_reuses_pending_quote(client, db_session):
    """
    Test C: Same request_id + same payload must reuse the same pending quote.
    """
    req_id = "idempotent_pending_quote_001"
    payload = {"text": "Reuse pending quote test", "source_lang": "en", "target_lang": "fr"}

    # First request -> issues quote
    res1 = client.post("/services/translate", json=payload, headers={"X-Request-ID": req_id})
    assert res1.status_code == 402
    quote_id_1 = res1.headers["X-Payment-Quote-Id"]

    # Second request with SAME request_id and SAME payload -> reuses quote
    res2 = client.post("/services/translate", json=payload, headers={"X-Request-ID": req_id})
    assert res2.status_code == 402
    quote_id_2 = res2.headers["X-Payment-Quote-Id"]

    assert quote_id_1 == quote_id_2
    assert res1.json()["quote_id"] == res2.json()["quote_id"]

    # Verify only ONE quote exists in DB for this request_id
    quotes = db_session.query(Quote).filter(Quote.request_id == req_id).all()
    assert len(quotes) == 1


def test_d_same_request_id_different_payload_returns_409_conflict(client):
    """
    Test D: Same request_id + different payload must return 409 REQUEST_ID_REUSE_CONFLICT.
    """
    req_id = "conflict_check_req_002"
    payload_1 = {"text": "Original payload content", "source_lang": "en", "target_lang": "es"}
    payload_2 = {"text": "Different payload content", "source_lang": "en", "target_lang": "es"}

    # First request
    res1 = client.post("/services/translate", json=payload_1, headers={"X-Request-ID": req_id})
    assert res1.status_code == 402

    # Second request with SAME request_id but DIFFERENT payload
    res2 = client.post("/services/translate", json=payload_2, headers={"X-Request-ID": req_id})
    assert res2.status_code == 409
    assert res2.json()["detail"] == "REQUEST_ID_REUSE_CONFLICT"


def test_e_idempotent_replay_after_delivery(client, db_session):
    """
    Test E: After payment and delivery, retrying the same request_id must return the exact
    persisted successful response/receipt without another payment, delivery, service execution, or receipt.
    """
    req_id = "delivered_idempotent_req_003"
    payload = {"text": "Execute once and replay", "source_lang": "en", "target_lang": "it"}

    # 1. Issue quote
    res_402 = client.post("/services/translate", json=payload, headers={"X-Request-ID": req_id})
    assert res_402.status_code == 402
    quote_id = res_402.headers["X-Payment-Quote-Id"]

    # 2. Pay and deliver
    proof = {"quote_id": quote_id, "tx_hash": "0xfirst_delivery_tx_3003", "payer_address": "0xClientPayer"}
    res_200_first = client.post(
        "/services/translate",
        json=payload,
        headers={"X-Payment-Proof": json.dumps(proof), "X-Request-ID": req_id}
    )
    assert res_200_first.status_code == 200
    data_first = res_200_first.json()
    receipt_first = data_first["receipt"]

    deliveries_count_1 = db_session.query(Delivery).filter(Delivery.request_id == req_id).count()
    payments_count_1 = db_session.query(Payment).filter(Payment.request_id == req_id).count()
    assert deliveries_count_1 == 1
    assert payments_count_1 == 1

    # 3. Retry with SAME request_id without payment proof
    res_retry_unpaid = client.post(
        "/services/translate",
        json=payload,
        headers={"X-Request-ID": req_id}
    )
    assert res_retry_unpaid.status_code == 200
    data_retry_unpaid = res_retry_unpaid.json()
    assert data_retry_unpaid["data"] == data_first["data"]
    assert data_retry_unpaid["receipt"]["receipt_id"] == receipt_first["receipt_id"]
    assert data_retry_unpaid["receipt"]["signature"] == receipt_first["signature"]

    # 4. Retry with SAME request_id with payment proof
    res_retry_paid = client.post(
        "/services/translate",
        json=payload,
        headers={"X-Payment-Proof": json.dumps(proof), "X-Request-ID": req_id}
    )
    assert res_retry_paid.status_code == 200
    data_retry_paid = res_retry_paid.json()
    assert data_retry_paid["receipt"]["receipt_id"] == receipt_first["receipt_id"]

    # Verify no second delivery or payment was created
    deliveries_count_2 = db_session.query(Delivery).filter(Delivery.request_id == req_id).count()
    payments_count_2 = db_session.query(Payment).filter(Payment.request_id == req_id).count()
    assert deliveries_count_2 == 1
    assert payments_count_2 == 1


def test_f_retrying_delivered_request_id_with_different_payload_returns_409(client):
    """
    Test F: Retrying delivered request_id with different payload returns 409 REQUEST_ID_REUSE_CONFLICT.
    """
    req_id = "delivered_conflict_req_004"
    payload_1 = {"text": "Original delivered text", "source_lang": "en", "target_lang": "es"}
    payload_2 = {"text": "Modified text after delivery", "source_lang": "en", "target_lang": "es"}

    # Issue quote & pay
    res_402 = client.post("/services/translate", json=payload_1, headers={"X-Request-ID": req_id})
    assert res_402.status_code == 402
    quote_id = res_402.headers["X-Payment-Quote-Id"]

    proof = {"quote_id": quote_id, "tx_hash": "0xdelivered_tx_4004", "payer_address": "0xClientPayer"}
    res_200 = client.post(
        "/services/translate",
        json=payload_1,
        headers={"X-Payment-Proof": json.dumps(proof), "X-Request-ID": req_id}
    )
    assert res_200.status_code == 200

    # Retry same request_id with different payload -> 409
    res_conflict = client.post(
        "/services/translate",
        json=payload_2,
        headers={"X-Request-ID": req_id}
    )
    assert res_conflict.status_code == 409
    assert res_conflict.json()["detail"] == "REQUEST_ID_REUSE_CONFLICT"


def test_g_preserves_payment_replay_protection_and_quote_expiry(client, db_session):
    """
    Test G: Preserve receipt signing, audit logging, payment replay protection, and quote expiry.
    """
    # 1. Quote Expiry Check
    req_id_expired = "expired_quote_req_005"
    res_exp_402 = client.post(
        "/services/translate",
        json={"text": "Expiry test", "source_lang": "en", "target_lang": "es"},
        headers={"X-Request-ID": req_id_expired}
    )
    quote_id_exp = res_exp_402.headers["X-Payment-Quote-Id"]

    # Manually expire the quote in DB
    q_exp = db_session.query(Quote).filter(Quote.id == quote_id_exp).first()
    q_exp.expires_at = datetime.utcnow() - timedelta(minutes=5)
    db_session.commit()

    proof_exp = {"quote_id": quote_id_exp, "tx_hash": "0xexpired_tx_5005", "payer_address": "0xClient"}
    res_exp_paid = client.post(
        "/services/translate",
        json={"text": "Expiry test", "source_lang": "en", "target_lang": "es"},
        headers={"X-Payment-Proof": json.dumps(proof_exp), "X-Request-ID": req_id_expired}
    )
    assert res_exp_paid.status_code == 400
    assert "has expired" in res_exp_paid.json()["detail"]

    # 2. Payment Replay / Double Spending Protection
    req_id_valid_1 = "valid_req_for_replay_test_1"
    res_v1 = client.post(
        "/services/translate",
        json={"text": "Replay test 1", "source_lang": "en", "target_lang": "es"},
        headers={"X-Request-ID": req_id_valid_1}
    )
    quote_id_v1 = res_v1.headers["X-Payment-Quote-Id"]
    shared_tx_hash = "0xshared_tx_hash_replay_6006"

    proof_v1 = {"quote_id": quote_id_v1, "tx_hash": shared_tx_hash, "payer_address": "0xClient"}
    res_v1_paid = client.post(
        "/services/translate",
        json={"text": "Replay test 1", "source_lang": "en", "target_lang": "es"},
        headers={"X-Payment-Proof": json.dumps(proof_v1), "X-Request-ID": req_id_valid_1}
    )
    assert res_v1_paid.status_code == 200

    # Attempt to use the same tx_hash on a second different quote
    req_id_valid_2 = "valid_req_for_replay_test_2"
    res_v2 = client.post(
        "/services/translate",
        json={"text": "Replay test 2", "source_lang": "en", "target_lang": "es"},
        headers={"X-Request-ID": req_id_valid_2}
    )
    quote_id_v2 = res_v2.headers["X-Payment-Quote-Id"]

    proof_v2 = {"quote_id": quote_id_v2, "tx_hash": shared_tx_hash, "payer_address": "0xClient"}
    res_v2_paid = client.post(
        "/services/translate",
        json={"text": "Replay test 2", "source_lang": "en", "target_lang": "es"},
        headers={"X-Payment-Proof": json.dumps(proof_v2), "X-Request-ID": req_id_valid_2}
    )
    assert res_v2_paid.status_code == 400
    assert "already been processed" in res_v2_paid.json()["detail"]
    assert "Double-spending attempt rejected" in res_v2_paid.json()["detail"]

    # 3. Receipt signing validity
    receipt_data = res_v1_paid.json()["receipt"]
    receipt_obj = ReceiptResponse(**receipt_data)
    assert verify_receipt_signature(receipt_obj) is True
