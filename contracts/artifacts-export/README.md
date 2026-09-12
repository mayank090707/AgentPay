# AgentPay — Team Integration Guide (Architecture v2)

This folder (`artifacts-export/`) is the **handoff point** between Person 1 (Blockchain & Smart Contract) and the rest of the team. It is populated after compilation/deployment by `scripts/exportAbi.js` or `scripts/deploy.js`.

---

## Files in this folder

| File | Description |
|------|-------------|
| `AgentPay.json` | Contract ABI — import this in Python (`web3.py`) or JavaScript (`ethers.js`) |
| `deployment.json` | Deployed contract address, network, chainId, deployer, agent, cap, timestamp |

---

## Common Data Model

All payments are identified by a unique `requestId` (`bytes32`).

```solidity
struct PaymentRecord {
    bytes32 requestId;    // keccak256 of unique request identifier (e.g. UUID)
    string  service;      // Human-readable service descriptor (e.g. "weather-report")
    address provider;     // Person 3's wallet address (ETH recipient)
    uint256 amount;       // Payment amount in wei
    bytes32 contentHash;  // keccak256 of delivery payload (set via recordDelivery)
    uint64  paidAt;       // block.timestamp when payment was authorized
    uint64  deliveredAt;  // block.timestamp when delivery was recorded (0 until delivered)
    bool    delivered;    // true once recordDelivery() has succeeded
}
```

---

## Person 2 — AI Agent / Payment Client (Python + `web3.py` or Node + `ethers.js`)

### Setup (Python)
```python
import os
import json
from web3 import Web3

w3 = Web3(Web3.HTTPProvider(os.getenv("SEPOLIA_RPC_URL", "https://rpc.sepolia.org")))

# Load ABI using relative path
with open("artifacts-export/AgentPay.json") as f:
    abi = json.load(f)["abi"]

# Prioritize CONTRACT_ADDRESS env var (Render/Production), fallback to deployment.json (local dev)
contract_address = os.getenv("CONTRACT_ADDRESS")
if not contract_address:
    try:
        with open("artifacts-export/deployment.json") as f:
            contract_address = json.load(f).get("contractAddress")
    except FileNotFoundError:
        raise Exception("CONTRACT_ADDRESS is required for production deployment.")

if not contract_address:
    raise Exception("CONTRACT_ADDRESS is required for production deployment.")

contract = w3.eth.contract(address=Web3.to_checksum_address(contract_address), abi=abi)
```

### Pre-flight Checks (Budget & Retry Guard)
Before sending any payment transaction, check remaining budget and whether the request was already processed:

```python
request_id = Web3.keccak(text="service-req-uuid-001")
cost_wei = Web3.to_wei(0.001, "ether")

# 1. Idempotency check — safe retry
if contract.functions.isProcessed(request_id).call():
    print("Request already processed on-chain! Skipping payment, fetching delivery.")
    # Proceed directly to check delivery / service status
    return

# 2. Budget check
remaining_budget = contract.functions.getRemaining().call()
if cost_wei > remaining_budget:
    raise Exception(f"Spend exceeds remaining budget: {cost_wei} > {remaining_budget}")
```

### Authorize & Execute Payment
Function signature in Solidity:
`authorizePayment(bytes32 requestId, uint256 amount, address provider, string calldata service)`

```python
# Build transaction (called by AGENT_ADDRESS)
tx = contract.functions.authorizePayment(
    request_id,
    cost_wei,
    PROVIDER_ADDRESS,      # Person 3's Sepolia wallet address
    "weather-report"       # Service descriptor
).build_transaction({
    "from": AGENT_ADDRESS,
    "nonce": w3.eth.get_transaction_count(AGENT_ADDRESS),
    "gas": 200000,
    "gasPrice": w3.eth.gas_price,
})

signed = w3.eth.account.sign_transaction(tx, AGENT_PRIVATE_KEY)
tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
print(f"Payment successful: {tx_hash.hex()}")
```

### Record Delivery Proof
After the backend delivers the service response, hash the content and record it:
```python
# Hash the service response payload
content_hash = Web3.keccak(text=raw_service_response_string)

tx_delivery = contract.functions.recordDelivery(
    request_id,
    content_hash
).build_transaction({
    "from": AGENT_ADDRESS,
    "nonce": w3.eth.get_transaction_count(AGENT_ADDRESS),
    "gas": 150000,
    "gasPrice": w3.eth.gas_price,
})

signed_del = w3.eth.account.sign_transaction(tx_delivery, AGENT_PRIVATE_KEY)
del_tx_hash = w3.eth.send_raw_transaction(signed_del.raw_transaction)
w3.eth.wait_for_transaction_receipt(del_tx_hash)
print(f"Delivery proof recorded: {content_hash.hex()}")
```

---

## Person 3 — Service Provider / Backend (FastAPI / Express / Node.js)

### Verify On-Chain Payment Before Service Delivery
When receiving an HTTP 402 payment proof with `requestId`:

```python
from web3 import Web3
import json

# Fetch on-chain payment record
payment = contract.functions.getPayment(request_id).call()
# Struct tuple: (requestId, service, provider, amount, contentHash, paidAt, deliveredAt, delivered)

paid_request_id = payment[0]
service_name    = payment[1]
paid_provider   = payment[2]
paid_amount     = payment[3]

if paid_amount == 0:
    raise HTTPException(status_code=402, detail="Payment not found on-chain")

if paid_provider.lower() != MY_PROVIDER_ADDRESS.lower():
    raise HTTPException(status_code=400, detail="Payment provider mismatch")

if paid_amount < EXPECTED_PRICE_WEI:
    raise HTTPException(status_code=402, detail="Insufficient payment amount")

# Deliver service response and provide computed content hash
response_data = {"result": "Sunny, 24C", "location": "San Francisco"}
serialized_data = json.dumps(response_data, sort_keys=True)
content_hash = Web3.keccak(text=serialized_data).hex()

return {
    "data": response_data,
    "contentHash": content_hash
}
```

---

## Person 4 — Frontend / Dashboard (React / Next.js / ethers.js)

### Read 4-Tuple Budget Status
```javascript
import { ethers } from "ethers";
import deployment from "./artifacts-export/deployment.json";
import agentPayArtifact from "./artifacts-export/AgentPay.json";

const contractAddress = process.env.CONTRACT_ADDRESS || process.env.VITE_CONTRACT_ADDRESS || deployment?.contractAddress;
if (!contractAddress) {
  throw new Error("CONTRACT_ADDRESS is required for production deployment.");
}

const contract = new ethers.Contract(contractAddress, agentPayArtifact.abi, provider);

// Returns: [hardSpendingCap, budget, totalSpent, remainingBudget]
const [hardCap, currentBudget, totalSpent, remaining] = await contract.getBudgetStatus();

console.log("Hard Cap:", ethers.formatEther(hardCap), "ETH");
console.log("Current Budget:", ethers.formatEther(currentBudget), "ETH");
console.log("Total Spent:", ethers.formatEther(totalSpent), "ETH");
console.log("Remaining Budget:", ethers.formatEther(remaining), "ETH");
```

### Event Subscriptions for Live UI Updates
```javascript
// Payment authorized & sent
contract.on("PaymentAuthorized", (requestId, service, provider, amount, totalSpent, remainingBudget) => {
  console.log("New Payment:", {
    requestId,
    service,
    provider,
    amount: ethers.formatEther(amount),
    totalSpent: ethers.formatEther(totalSpent),
    remainingBudget: ethers.formatEther(remainingBudget)
  });
});

// Delivery proof recorded
contract.on("DeliveryRecorded", (requestId, contentHash) => {
  console.log("Delivery Proof Recorded:", { requestId, contentHash });
});

// Budget adjusted by Owner
contract.on("BudgetSet", (oldBudget, newBudget) => {
  console.log(`Budget adjusted: ${ethers.formatEther(oldBudget)} -> ${ethers.formatEther(newBudget)} ETH`);
});
```

### Fetch Payment Details & Verification
```javascript
const record = await contract.getPayment(requestId);
// record.requestId: bytes32
// record.service: string
// record.provider: address
// record.amount: BigInt
// record.contentHash: bytes32
// record.paidAt: BigInt (timestamp)
// record.deliveredAt: BigInt (timestamp, 0 if not yet delivered)
// record.delivered: boolean
```

---

## Complete ABI Function & Error Reference

### State-Changing Functions
| Function | Caller | Description |
|---|---|---|
| `setBudget(uint256 amount)` | Owner only | Adjusts mutable operational budget (`totalSpent <= amount <= hardSpendingCap`) |
| `authorizePayment(bytes32 requestId, uint256 amount, address provider, string service)` | Agent only | Atomically authorizes and transfers ETH to provider, updates accounting |
| `recordDelivery(bytes32 requestId, bytes32 contentHash)` | Agent only | Records delivery proof contentHash for an existing paid request |
| `fund()` *(payable)* | Anyone | Top up contract ETH balance (also via direct transfer to contract) |
| `withdraw(uint256 amount)` | Owner only | Withdraw unspent ETH from contract |
| `setAgent(address newAgent)` | Owner only | Rotate authorized AI agent address |

### View Functions
| Function | Returns | Description |
|---|---|---|
| `getBudget()` | `uint256` | Current operational budget |
| `getSpent()` | `uint256` | Total wei spent so far |
| `getRemaining()` | `uint256` | Remaining spendable budget (`budget - totalSpent`) |
| `getHardCap()` | `uint256` | Immutable lifetime hard spending cap |
| `getBudgetStatus()` | `(uint256, uint256, uint256, uint256)` | `(hardCap, budget, totalSpent, remaining)` |
| `isProcessed(bytes32 requestId)` | `bool` | True if request was already paid (idempotency guard) |
| `getDeliveryHash(bytes32 requestId)` | `bytes32` | Returns recorded delivery hash (or `bytes32(0)` if not delivered) |
| `getPayment(bytes32 requestId)` | `PaymentRecord` | Returns full record struct |
| `getContractBalance()` | `uint256` | Current ETH balance held by the contract |
| `owner()` | `address` | Contract owner address |
| `agent()` | `address` | Authorized agent address |

### Custom Errors
| Custom Error | Emitted When |
|---|---|
| `NotOwner()` | Caller is not the contract owner |
| `NotAgent()` | Caller is not the authorized agent |
| `AlreadyProcessed(bytes32 requestId)` | `requestId` was already paid (prevents double charging) |
| `NotProcessed(bytes32 requestId)` | Attempted `recordDelivery` on an unpaid request |
| `AlreadyDelivered(bytes32 requestId)` | Delivery was already recorded for this request |
| `BudgetExceeded(uint256 requested, uint256 remaining)` | Payment would exceed `getRemaining()` |
| `BudgetExceedsHardCap(uint256 requested, uint256 hardCap)` | `setBudget` parameter exceeds immutable `hardSpendingCap` |
| `BudgetBelowSpent(uint256 requested, uint256 spent)` | `setBudget` parameter is less than already-spent wei |
| `InsufficientContractBalance(uint256 requested, uint256 balance)` | Contract ETH balance cannot cover payment or withdrawal |
| `PaymentFailed()` | Low-level ETH transfer reverted |
| `ZeroAddress()` | Address parameter is `address(0)` |
| `ZeroAmount()` | Value/amount parameter is 0 |
| `ZeroContentHash()` | `recordDelivery` called with empty `bytes32(0)` |
| `EmptyService()` | `authorizePayment` called with empty string |
