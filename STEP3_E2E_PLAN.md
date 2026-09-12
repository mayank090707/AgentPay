# STEP 3 — Local End-to-End Verification Plan

This plan documents the discovered architecture and exact commands required to run and verify the AgentPay system locally in `C:\Users\Mayank Sharma\Desktop\AgentPayUltra\Integration-Person2-Person3`.

---

## Discovered System Architecture & Entry Points

```
Vite React Frontend (Port 5173)
       │
       │ HTTP REST API (VITE_API_BASE_URL)
       ▼
FastAPI Person 3 Provider Backend (Port 8000)
       │
       │ HTTP 402 Handshake & Quote Response
       ▼
Python Person 2 Agent Runtime (Port 8001 / Orchestrator)
       │
       │ Web3 JSON-RPC (eth_sendTransaction)
       ▼
Hardhat Local Blockchain Node / AgentPay.sol (Port 8545, Chain ID 31337)
```

---

## Discovered API Routes (FastAPI Backend)

- `GET  /providers` — List registered service providers
- `GET  /providers/compare/{service_type}` — Compare provider pricing
- `POST /services/translate` — Translation service execution (returns 402 if unfulfilled quote)
- `POST /services/compute` — Compute service execution
- `POST /services/storage` — Storage service execution
- `POST /payment/verify` — Verify transaction payment receipt
- `GET  /payment/quote/{quote_id}` — Query quote status
- `GET  /receipts/{request_id}` — Retrieve HMAC-signed receipt
- `GET  /audit/logs` — Fetch SQLite audit trail records
- `GET  /audit/verify/{request_id}` — Cryptographic audit trail verification endpoint

---

## Discovered Smart Contract Interface (`AgentPay.sol`)

- `authorizePayment(bytes32 requestId, uint256 amount, address provider, string service)` — Deducts budget, transfers ETH, emits `PaymentAuthorized`
- `recordDelivery(bytes32 requestId, bytes32 contentHash)` — Logs payload content hash, emits `DeliveryRecorded`
- `getBudgetStatus()` — Returns `(hardSpendingCap, budget, totalSpent, remaining)`
- `isProcessed(bytes32 requestId)` — Idempotency check / retry guard

---

## Exact Local Startup Commands

### 1. Blockchain (Hardhat Local Node & Deploy)
```bash
cd contracts
npx hardhat node
# In a separate terminal:
npx hardhat run scripts/deploy.js --network localhost
```

### 2. Person 3 FastAPI Backend
```bash
# From workspace root:
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

### 3. Person 2 AI Agent Runtime
```bash
# From workspace root:
python -m agent.src.main --port 8001
```

### 4. React Frontend
```bash
# From workspace root:
npm run dev
```

---

## Required Local Environment (.env)

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_CONTRACT_ADDRESS=<DEPLOYED_LOCAL_CONTRACT_ADDRESS>
VITE_CHAIN_ID=31337
VITE_PUBLIC_RPC_URL=http://127.0.0.1:8545
AGENT_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
HARD_SPENDING_CAP_WEI=10000000000000000
INITIAL_FUND_WEI=10000000000000000
```
