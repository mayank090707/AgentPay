# AgentPay — Integration Handoff Document

This document serves as the official integration handoff specification between **Person 1 (Blockchain & Smart Contract)** and **Person 2 (AI Agent)**, **Person 3 (Service Provider Backend)**, and **Person 4 (Frontend / Dashboard)**.

---

## 1. Network & Chain Configuration

| Parameter | Value |
|---|---|
| **Network Name** | Ethereum Sepolia Testnet |
| **Chain ID** | `11155111` |
| **RPC Endpoint** | Configured via `SEPOLIA_RPC_URL` (Infura / Alchemy / public RPC) |
| **Native Currency** | Sepolia ETH (18 decimals, 1 ETH = $10^{18}$ wei) |
| **Block Explorer** | `https://sepolia.etherscan.io` |

---

## 2. Contract Coordinates

| Attribute | Location / Identifier |
|---|---|
| **Contract Name** | `AgentPay` |
| **Contract Address** | `TO BE FILLED AFTER LIVE DEPLOYMENT` (recorded in `artifacts-export/deployment.json`) |
| **Contract ABI** | [`artifacts-export/AgentPay.json`](./AgentPay.json) |
| **Deployment Metadata** | [`artifacts-export/deployment.json`](./deployment.json) |
| **Etherscan URL** | `https://sepolia.etherscan.io/address/<CONTRACT_ADDRESS>` (generated post-deployment) |

---

## 3. Protocol Roles & Access Control

| Role | Wallet Key Holder | On-Chain Functionality |
|---|---|---|
| **Owner (Person 1)** | Deployer EOA | Calls `setBudget()`, `withdraw()`, `setAgent()`, `fund()` |
| **Authorized Agent (Person 2)** | AI Agent EOA (`agent`) | Sole caller of `authorizePayment()` and `recordDelivery()` |
| **Provider (Person 3)** | Service Provider EOA | ETH recipient specified in `authorizePayment(..., provider, ...)` |
| **Viewer / Dashboard (Person 4)** | Any public caller | Queries all `view` methods (`getBudgetStatus()`, `getPayment()`, etc.) |

---

## 4. Key Smart Contract Functions

### State-Changing Methods

1. **`authorizePayment(bytes32 requestId, uint256 amount, address provider, string calldata service)`**
   - **Caller**: Authorized Agent only (`onlyAgent`)
   - **Action**: Atomically checks budget limits & balance, marks `requestId` as processed, transfers native ETH to `provider`, updates accounting, and emits `PaymentAuthorized`.
   - **Reverts**: `AlreadyProcessed` if reused, `BudgetExceeded` if payment exceeds remaining budget, `InsufficientContractBalance` if contract balance is too low, `ZeroAmount`, `ZeroAddress`, `EmptyService`.

2. **`recordDelivery(bytes32 requestId, bytes32 contentHash)`**
   - **Caller**: Authorized Agent only (`onlyAgent`)
   - **Action**: Permanently binds the service output cryptographic digest `contentHash` to the paid `requestId`, marks `delivered = true`, sets `deliveredAt = block.timestamp`, and emits `DeliveryRecorded`.
   - **Reverts**: `NotProcessed` if request was not paid, `AlreadyDelivered` if already recorded, `ZeroContentHash` if `bytes32(0)`.

3. **`setBudget(uint256 amount)`**
   - **Caller**: Owner only (`onlyOwner`)
   - **Action**: Dynamically lowers or raises operational budget. Enforces invariant: `totalSpent <= amount <= hardSpendingCap`.

4. **`fund()` (payable)**
   - **Caller**: Anyone
   - **Action**: Tops up the contract's ETH vault balance. Direct ETH transfers to the contract also trigger `receive()` and fund the contract.

5. **`withdraw(uint256 amount)`**
   - **Caller**: Owner only (`onlyOwner`)
   - **Action**: Withdraws unspent ETH from the contract balance back to the owner.

### Public View Methods

| Function | Returns | Purpose |
|---|---|---|
| `getBudget()` | `uint256` | Current operational budget (wei) |
| `getSpent()` | `uint256` | Cumulative wei spent across all payments |
| `getRemaining()` | `uint256` | Spendable wei remaining (`budget - totalSpent`) |
| `getHardCap()` | `uint256` | Immutable lifetime ceiling (wei) |
| `isProcessed(bytes32 requestId)` | `bool` | Idempotency guard: `true` if already paid, `false` otherwise |
| `getDeliveryHash(bytes32 requestId)` | `bytes32` | Returns recorded delivery hash (`bytes32(0)` if pending) |
| `getPayment(bytes32 requestId)` | `PaymentRecord` | Returns full struct: `(requestId, service, provider, amount, contentHash, paidAt, deliveredAt, delivered)` |
| `getBudgetStatus()` | `(uint256, uint256, uint256, uint256)` | Single-call tuple: `(hardCap, budget, totalSpent, remaining)` |
| `getContractBalance()` | `uint256` | Live native ETH balance held in the contract vault |

---

## 5. Event Specifications

- **`PaymentAuthorized(bytes32 indexed requestId, string service, address indexed provider, uint256 amount, uint256 totalSpent, uint256 remainingBudget)`**
- **`DeliveryRecorded(bytes32 indexed requestId, bytes32 contentHash)`**
- **`BudgetSet(uint256 oldBudget, uint256 newBudget)`**
- **`Funded(address indexed by, uint256 amount)`**
- **`Withdrawn(address indexed to, uint256 amount)`**
- **`AgentUpdated(address indexed oldAgent, address indexed newAgent)`**

---

## 6. Core Technical Standards

1. **Payment Asset**: Native ETH (`msg.value`, transferred in `wei`). 1 ETH = `1000000000000000000` wei.
2. **`requestId` Format**: `bytes32`. Derived using `keccak256(utf8Bytes(uuid))` or `ethers.id("service-purchase-UUID")`.
3. **Idempotency & Retry Behavior**:
   - Before submitting any payment, Person 2 checks `contract.isProcessed(requestId)`.
   - If `true`, the payment was already recorded; Person 2 proceeds directly to fetch delivery without re-paying.
   - If Person 2 accidentally resubmits the same `requestId`, the contract immediately reverts with `AlreadyProcessed(requestId)` before transferring any funds.
4. **Delivery `contentHash` Verification**:
   - Person 3 computes `keccak256` over the canonical serialized JSON payload of the service response:
     ```python
     content_hash = Web3.keccak(text=json.dumps(response_payload, sort_keys=True)).hex()
     ```
   - Person 2 submits this hash to `recordDelivery(requestId, contentHash)`.
   - Person 4 or any auditor can independently hash the response payload and verify it matches `getDeliveryHash(requestId)`.

---

## 7. Payment Flow (x402 Protocol)

1. **Person 2** creates a unique `requestId` (`keccak256(UUID)`).
2. **Person 2** calls `authorizePayment(requestId, amount, provider, service)`.
3. **Contract** verifies caller is authorized agent, budget limit is respected, contract balance is sufficient, and request has not been processed before (`isProcessed == false`).
4. **Contract** atomically updates spend accounting and transfers native ETH to `provider`.
5. **Person 3** (provider backend) verifies payment on-chain via `getPayment(requestId)` and delivers the purchased service.
6. **Person 2** receives the service output payload and computes/receives `contentHash`.
7. **Person 2** calls `recordDelivery(requestId, contentHash)` to bind delivery proof on-chain.
8. **Person 4** (frontend/dashboard) reads the updated payment and delivery state in real-time.

```text
Person 2 (AI Agent)           Person 3 (Service Provider)        AgentPay Contract
       |                                  |                              |
       |----- 1. GET /weather ----------->|                              |
       |<---- 2. HTTP 402 Payment Req ----|                              |
       |      (Price, Provider Address,   |                              |
       |       Request UUID)              |                              |
       |                                  |                              |
       |----- 3. isProcessed(reqId) ------------------------------------>|
       |<---- 4. false (not paid yet) -----------------------------------|
       |                                  |                              |
       |----- 5. authorizePayment(reqId, amount, provider, "weather") --->|
       |                                  |                              | [Checks: Budget & Balance]
       |                                  |<-- 6. ETH Transfer (wei) ----| [Effects: totalSpent += amount]
       |<---- 7. PaymentAuthorized Tx Receipt ---------------------------|
       |                                  |                              |
       |----- 8. GET /weather + ReqId --->|                              |
       |                                  |-- 9. getPayment(reqId) ----->|
       |                                  |<- 10. Valid & Paid ---------|
       |<---- 11. HTTP 200 + ContentHash -|                              |
       |                                  |                              |
       |----- 12. recordDelivery(reqId, contentHash) ------------------->|
       |                                  |                              | [Store contentHash]
       |<---- 13. DeliveryRecorded Event --------------------------------|
```
