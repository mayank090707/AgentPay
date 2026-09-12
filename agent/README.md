# Person 2 — AI Agent + Payment Subsystem

This package implements the core logic for **Person 2: AI Agent + Payment** in the Code Hawk ecosystem.

---

## 1. Person 2 Responsibility & Architecture

In the complete multi-party architecture:

```
USER
  ↓
AI AGENT (Person 2)
  ↓
SERVICE REQUEST
  ↓
PROVIDER (Person 3)
  ↓
HTTP 402 PAYMENT REQUIRED
  ↓
PAYMENT REQUIREMENT
  ↓
SMART CONTRACT (Person 1)
  ↓
PAYMENT
  ↓
PROVIDER VERIFICATION (Person 3)
  ↓
SERVICE DELIVERY
  ↓
RECEIPT + CONTENT HASH
  ↓
AGENT STATE / EVENTS
  ↓
DASHBOARD (Person 4)
```

### Core Architectural Principle
The **Smart Contract (Person 1)** is the sole authority for:
- Spending budget enforcement
- Payment authorization
- Duplicate/idempotent payment protection

The AI Agent **MUST NOT** be the authority for spending. The agent never implements local Python-side budget enforcement as security logic; it checks, authorizes, and records state strictly in accordance with smart contract outcomes.

---

## 2. Current Status: Phase 1 (Foundation & Domain Layer)

Phase 1 establishes the clean domain concepts, typed models, state management, event definitions, configuration interface, logging, and error hierarchy that all subsequent phases will build upon.

### Intentionally NOT Implemented in Phase 1
To maintain strict architectural boundaries, the following are intentionally deferred to subsequent integration phases:
- ❌ Blockchain transactions & Web3 contract calls
- ❌ Smart contract ABIs or mock contracts
- ❌ HTTP 402 provider networking / REST clients
- ❌ Mock providers or fake payment execution
- ❌ LLM / AI model integrations
- ❌ Automated retry execution engine
- ❌ FastAPI state server or WebSocket endpoints
- ❌ Frontend UI or database persistence
- ❌ Docker containerization or cloud deployment

---

## 3. Domain Models Overview

| Model / Type | Description |
| :--- | :--- |
| `RequestId` | Domain value object strictly adhering to `0x` + 64 hexadecimal characters (32 bytes). Survives the entire purchase lifecycle from request to receipt, matching future Solidity `bytes32`. |
| `AgentStage` | Explicit lifecycle enum: `IDLE`, `TASK_RECEIVED`, `PROVIDER_REQUESTED`, `HTTP_402_RECEIVED`, `CONTRACT_AUTHORIZING`, `PAYMENT_APPROVED`, `BLOCKED_BY_SMART_CONTRACT`, `PAYMENT_SUBMITTED`, `PAYMENT_CONFIRMED`, `DELIVERY_PENDING`, `SERVICE_FULFILLED`, `DELIVERY_FAILED`, `RECEIPT_RECORDED`, `RETRYING`, `COMPLETED`, `FAILED`. |
| `PaymentStatus` | Payment status enum: `PENDING`, `APPROVED`, `SUBMITTED`, `CONFIRMED`, `BLOCKED`, `FAILED`. |
| `DeliveryStatus` | Delivery status enum: `PENDING`, `FULFILLED`, `FAILED`. |
| `ServiceRequest` | Represents an outgoing request for a service (`service`, `payload`, `parameters`, `provider`, `request_id`). |
| `PaymentRequirement` | Payment terms from provider's 402 response (`request_id`, `amount`, `currency`, `provider`, `payment_address`, `network`, `metadata`). |
| `PaymentResult` | Result of payment execution (`request_id`, `amount`, `status`, `transaction_hash`, `error_reason`). |
| `DeliveryResult` | Operational outcome of service delivery attempt (`request_id`, `delivery_status`, `result`, `content_hash`, `error_reason`, `timestamp`). |
| `ServiceReceipt` | Domain representation of the commercial/audit receipt binding request, provider, payment reference, and content hash. |
| `AgentState` | Dashboard-facing aggregate state (`current_task`, `provider`, `amount`, `currency`, `request_id`, `stage`, `payment_status`, `delivery_status`, `transaction_hash`, `content_hash`, `error_reason`, `timestamp`). |
| `StateManager` | Thread-safe in-memory state manager holding `AgentState` with transition methods and subscriber notifications. |
| `AgentEvent` & `EventEmitter` | Structured event payloads and thread-safe dispatcher recording timeline history for Person 4 dashboard replay. |
| `Settings` | Environment-based settings via `pydantic-settings` with direct environment variable mapping (`RPC_URL`, `CONTRACT_ADDRESS`, `CHAIN_ID`, `AGENT_ADDRESS`, `AGENT_PRIVATE_KEY`, `PROVIDER_BASE_URL`, `AGENT_PORT`, `ENVIRONMENT`, `LOG_LEVEL`). |
| `AgentError` | Exception hierarchy with rich context (`code`, `request_id`, `details`) covering configuration, validation, provider, contract, payment, delivery, and retries. |

---

## 4. Installation & Setup

### Prerequisites
- Python 3.10+

### Install Dependencies
```bash
pip install -r agent/requirements.txt
```

Only clean foundation dependencies are installed:
- `pydantic>=2.5.0`
- `pydantic-settings>=2.0.0`
- `pytest>=8.0.0`

---

## 5. Running Tests

From the workspace root (`D:\code hawk`):

```bash
pytest agent/tests/unit -v
```

All tests validate domain modeling, state management, event dispatching, RequestId constraints, logging sanitization, and exception structures without network or mock dependencies.

---

## 6. Roadmap: Upcoming Phases

- **Phase 2: Contract Client & Smart Contract Integration** (Web3, ABI integration with Person 1's contract, `authorizePayment()` integration, event decoding).
- **Phase 3: Provider HTTP 402 Client** (Service discovery, 402 requirement parsing, hash verification with Person 3).
- **Phase 4: Payment Client & Execution** (Safe on-chain / off-chain payment dispatch, receipt confirmation).
- **Phase 5: Orchestrator & Retry Engine** (Full state machine, exponential backoff, transaction lifecycle orchestration).
- **Phase 6: AI Layer** (Agentic reasoning, task breakdown, prompt/tooling orchestration).
- **Phase 7: Dashboard State Server** (FastAPI / SSE / WebSocket server exposing state and events to Person 4).
