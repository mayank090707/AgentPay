import pytest
from fastapi.testclient import TestClient
from backend.app.models.audit import AuditLog

def test_get_security_summary(client: TestClient):
    response = client.get("/security-demo/summary")
    assert response.status_code == 200
    data = response.json()
    assert "hard_cap" in data
    assert "total_spent" in data
    assert "remaining_budget" in data
    assert "blocked_attempts" in data
    assert "duplicate_prevention_count" in data
    assert "contract_address" in data
    assert "Sepolia" in data["enforcement_layer"]


def test_simulate_budget_exceeded(client: TestClient, db_session):
    response = client.post("/security-demo/budget-exceeded")
    assert response.status_code == 200
    data = response.json()

    assert data["scenario"] == "budget_exceeded"
    assert data["request_id"].startswith("0x")
    assert len(data["request_id"]) == 66
    assert data["blocked"] is True
    assert "BUDGET_EXCEEDED" in data["rejection_reason"]
    assert data["contract_result"].startswith("REJECTED_ON_CHAIN")

    # Verify audit event in DB
    log = db_session.query(AuditLog).filter(AuditLog.request_id == data["request_id"]).first()
    assert log is not None
    assert log.event_type == "BUDGET_EXCEEDED"


def test_simulate_double_payment(client: TestClient, db_session):
    response = client.post("/security-demo/double-payment")
    assert response.status_code == 200
    data = response.json()

    assert data["scenario"] == "double_payment_protection"
    assert data["request_id"].startswith("0x")
    assert len(data["request_id"]) == 66
    assert data["first_payment"]["amount"] == "0.0001 ETH"
    assert data["retry"]["status"] == "REJECTED"
    assert "AlreadyProcessed" in data["retry"]["reason"]
    assert data["retry"]["amount_deducted"] == "0.00 ETH"
    assert data["duplicate_payment_prevented"] is True

    # Verify audit events in DB (FIRST_PAYMENT and DUPLICATE_PAYMENT_BLOCKED)
    logs = db_session.query(AuditLog).filter(AuditLog.request_id == data["request_id"]).all()
    event_types = [l.event_type for l in logs]
    assert "SECURITY_DEMO_FIRST_PAYMENT" in event_types
    assert "DUPLICATE_PAYMENT_BLOCKED" in event_types
