# AgentPay — Client Integration Code Examples (ethers.js v6)

This document provides minimal, production-ready code examples for **Person 2 (AI Agent)** and **Person 4 (Frontend / Dashboard)** to integrate with the `AgentPay` smart contract using `ethers.js` (v6).

---

## 1. Setup & Initialization

```javascript
import { ethers } from "ethers";
import agentPayArtifact from "./AgentPay.json" assert { type: "json" };
import deploymentMetadata from "./deployment.json" assert { type: "json" };

// Configuration placeholders (Prioritize environment variables on Render)
const RPC_URL = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || deploymentMetadata?.contractAddress;
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY; // Backend/Agent ONLY — NEVER expose to frontend

if (!CONTRACT_ADDRESS) {
  throw new Error("CONTRACT_ADDRESS is required for production deployment.");
}

// Provider (read-only queries)
const provider = new ethers.JsonRpcProvider(RPC_URL);

// Agent Signer (for state-changing transactions — Person 2 Backend ONLY)
const agentWallet = AGENT_PRIVATE_KEY ? new ethers.Wallet(AGENT_PRIVATE_KEY, provider) : null;

// Contract Instances
const readOnlyContract = new ethers.Contract(CONTRACT_ADDRESS, agentPayArtifact.abi, provider);
const agentContract = agentWallet ? new ethers.Contract(CONTRACT_ADDRESS, agentPayArtifact.abi, agentWallet) : null;
```

---

## 2. Generating & Handling `requestId`

All payments require a `bytes32` identifier. Generate it deterministically using `ethers.id()` or `ethers.keccak256`:

```javascript
// Generate deterministic bytes32 requestId from a unique service request UUID
const requestUuid = "req-service-uuid-12345678";
const requestId = ethers.id(requestUuid); // returns 0x... (32 bytes)
```

---

## 3. Idempotency Check (Pre-flight before paying)

Always check `isProcessed(requestId)` before initiating payment to prevent double charging:

```javascript
async function checkBeforePay(requestId) {
  const alreadyProcessed = await readOnlyContract.isProcessed(requestId);
  if (alreadyProcessed) {
    console.log("Request was already paid! Skipping payment, fetching service result directly.");
    return false; // do not call authorizePayment
  }
  return true; // safe to proceed with payment
}
```

---

## 4. Querying Budget & Spending Limits

```javascript
async function fetchBudgetMetrics() {
  // Option A: Single 4-tuple read (recommended for dashboard)
  const [hardCap, currentBudget, totalSpent, remainingBudget] = await readOnlyContract.getBudgetStatus();

  console.log("Hard Spending Cap:", ethers.formatEther(hardCap), "ETH");
  console.log("Operational Budget:", ethers.formatEther(currentBudget), "ETH");
  console.log("Total Spent:", ethers.formatEther(totalSpent), "ETH");
  console.log("Remaining Budget:", ethers.formatEther(remainingBudget), "ETH");

  // Option B: Individual project guide getters
  const budget = await readOnlyContract.getBudget();
  const spent = await readOnlyContract.getSpent();
  const remaining = await readOnlyContract.getRemaining();
}
```

---

## 5. Authorizing & Executing Payment (Person 2 AI Agent)

Function Signature:
`authorizePayment(bytes32 requestId, uint256 amount, address provider, string service)`

```javascript
async function makeServicePayment(requestId, costInEth, providerAddress, serviceLabel) {
  const costWei = ethers.parseEther(costInEth); // amount in wei

  // Pre-flight balance & budget checks
  const remaining = await readOnlyContract.getRemaining();
  if (costWei > remaining) {
    throw new Error(`Payment of ${costInEth} ETH exceeds remaining budget (${ethers.formatEther(remaining)} ETH).`);
  }

  console.log(`Sending payment for "${serviceLabel}" to ${providerAddress}...`);
  const tx = await agentContract.authorizePayment(
    requestId,
    costWei,
    providerAddress,
    serviceLabel
  );

  console.log("Transaction submitted. Hash:", tx.hash);
  const receipt = await tx.wait(1);
  console.log("Payment confirmed in block:", receipt.blockNumber);
  return receipt;
}
```

---

## 6. Recording Delivery Proof (Person 2 AI Agent)

After receiving the service output from Person 3, hash the output payload and record it on-chain:

```javascript
async function recordDeliveryProof(requestId, serviceOutputPayloadString) {
  // Derive cryptographic digest from service response body
  const contentHash = ethers.keccak256(ethers.toUtf8Bytes(serviceOutputPayloadString));

  console.log("Recording delivery proof hash:", contentHash);
  const tx = await agentContract.recordDelivery(requestId, contentHash);
  const receipt = await tx.wait(1);
  console.log("Delivery recorded on-chain in block:", receipt.blockNumber);
  return receipt;
}
```

---

## 7. Verifying Delivery & Reading Records (Person 3 & Person 4)

```javascript
async function inspectPaymentRecord(requestId) {
  const payment = await readOnlyContract.getPayment(requestId);

  console.log("Payment Record:");
  console.log("  - Request ID:   ", payment.requestId);
  console.log("  - Service:      ", payment.service);
  console.log("  - Provider:     ", payment.provider);
  console.log("  - Amount:       ", ethers.formatEther(payment.amount), "ETH");
  console.log("  - Content Hash: ", payment.contentHash);
  console.log("  - Paid At:      ", new Date(Number(payment.paidAt) * 1000).toISOString());
  console.log("  - Delivered At: ", payment.deliveredAt > 0n ? new Date(Number(payment.deliveredAt) * 1000).toISOString() : "Pending");
  console.log("  - Delivered:    ", payment.delivered);

  // Or read only the hash
  const deliveryHash = await readOnlyContract.getDeliveryHash(requestId);
}
```

---

## 8. Real-Time Event Listeners (Person 4 Dashboard)

```javascript
function subscribeToEvents() {
  // Listen for payments
  readOnlyContract.on("PaymentAuthorized", (requestId, service, provider, amount, totalSpent, remainingBudget, event) => {
    console.log("⚡ [PaymentAuthorized]", {
      requestId,
      service,
      provider,
      amountEth: ethers.formatEther(amount),
      totalSpentEth: ethers.formatEther(totalSpent),
      remainingEth: ethers.formatEther(remainingBudget),
    });
  });

  // Listen for delivery proof recording
  readOnlyContract.on("DeliveryRecorded", (requestId, contentHash, event) => {
    console.log("📦 [DeliveryRecorded]", { requestId, contentHash });
  });

  // Listen for budget adjustments by Owner
  readOnlyContract.on("BudgetSet", (oldBudget, newBudget, event) => {
    console.log("⚙️ [BudgetSet]", {
      oldBudgetEth: ethers.formatEther(oldBudget),
      newBudgetEth: ethers.formatEther(newBudget),
    });
  });
}
```

---

## 9. Frontend Safety Guidelines (React / Next.js / Vite on Render)

For browser and dashboard frontend deployments:

- **NEVER expose `AGENT_PRIVATE_KEY` or `DEPLOYER_PRIVATE_KEY`** in frontend code, client bundles, or environment variables.
- **Frontend only needs read-only access** to query state and listen to events.
- If using Vite, configure public variables with the `VITE_` prefix:
  ```env
  VITE_CONTRACT_ADDRESS=0xYOUR_LIVE_SEPOLIA_CONTRACT
  VITE_CHAIN_ID=11155111
  VITE_PUBLIC_RPC_URL=https://rpc.sepolia.org
  ```
- If using Next.js, use `NEXT_PUBLIC_CONTRACT_ADDRESS` and `NEXT_PUBLIC_CHAIN_ID`.
- If using the AgentPay backend service on Render, the frontend can query `GET /api/status` and `GET /api/abi` without needing any RPC keys or local files!
