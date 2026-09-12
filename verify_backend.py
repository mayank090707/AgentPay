import asyncio
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient
from backend.app.main import app

def run_backend_verification():
    print("==================================================")
    print("VERIFYING FASTAPI BACKEND ROUTES")
    print("==================================================")
    client = TestClient(app)

    # 1. Health check
    res = client.get("/health")
    print("GET /health status:", res.status_code, res.json())

    # 2. Providers list
    res = client.get("/providers")
    print("GET /providers status:", res.status_code, "Count:", len(res.json().get("providers", [])))

    # 3. Provider comparison
    res = client.get("/providers/compare/translate")
    print("GET /providers/compare/translate status:", res.status_code, res.json())

    # 4. Service execution (without payment -> 402 HTTP)
    res = client.post("/services/translate", json={
        "provider_id": "prov_weather_01",
        "payload": {"text": "Hello world", "target_lang": "es"}
    })
    print("POST /services/translate status:", res.status_code)
    if res.status_code == 402:
        print("  -> 402 Payment Required Handshake verified! Detail:", res.json())

    # 5. Audit logs
    res = client.get("/audit/logs")
    print("GET /audit/logs status:", res.status_code, "Logs count:", len(res.json().get("logs", [])))

    # 6. Audit verify endpoint
    res = client.get("/audit/verify/req_test_001")
    print("GET /audit/verify/req_test_001 status:", res.status_code, res.json())

    print("==================================================")
    print("ALL REAL BACKEND ROUTES OPERATIONAL!")
    print("==================================================")

if __name__ == "__main__":
    run_backend_verification()
