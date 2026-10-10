/**
 * AgentPay Shared Mock Data Model
 * Aligned with backend/blockchain common schema:
 * - request_id
 * - service
 * - provider
 * - amount
 * - payment_tx
 * - delivery_status ('Delivered' | 'Blocked' | 'Processing' | 'Failed')
 * - content_hash
 * - timestamp
 * - error
 */

export const mockContractSummary = {
  totalBudget: 500,
  totalSpent: 320,
  remainingBudget: 180,
  totalTransactions: 12,
  successfulTransactions: 10,
  blockedTransactions: 2,
  currency: "₹",
  enforcedBySmartContract: true,
  contractAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  network: "Sepolia Connected",
  walletAddress: "0x3A8F...91B2"
};

export const mockSpendingOverview = [
  { date: "Sep 6", successful: 50, blocked: 0 },
  { date: "Sep 7", successful: 70, blocked: 0 },
  { date: "Sep 8", successful: 110, blocked: 0 },
  { date: "Sep 9", successful: 90, blocked: 0 },
  { date: "Sep 10", successful: 80, blocked: 45 },
  { date: "Sep 11", successful: 110, blocked: 0 },
  { date: "Sep 12", successful: 90, blocked: 88 },
];

export const mockTransactions = [
  {
    request_id: "A104",
    service: "Translation",
    provider: "LinguaAI",
    amount: 50.00,
    payment_tx: "0x89f2a1b0c9e8d7f6a5b4c3d2e1f0",
    delivery_status: "Delivered",
    content_hash: "0x4e8d2a1b9c8f7e6d5c4b3a21",
    timestamp: "12:31 PM",
    date: "2026-09-12",
    error: null
  },
  {
    request_id: "A103",
    service: "Storage",
    provider: "FileDock",
    amount: 100.00,
    payment_tx: "0x12c...9e4b",
    delivery_status: "Delivered",
    content_hash: "0x9a8b7c6d5e4f3a2b1c0d9e8f",
    timestamp: "11:20 AM",
    date: "2026-09-12",
    error: null
  },
  {
    request_id: "A105",
    service: "Compute",
    provider: "CloudNet",
    amount: 200.00,
    payment_tx: "0x000...REJECTED",
    delivery_status: "Blocked",
    content_hash: "N/A - Budget Exceeded",
    timestamp: "10:05 AM",
    date: "2026-09-12",
    error: "SmartContract: Hard spending limit exceeded (Attempted ₹200, Remaining ₹180)"
  },
  {
    request_id: "A102",
    service: "Translation",
    provider: "LinguaAI",
    amount: 50.00,
    payment_tx: "0x3d7...1f9a",
    delivery_status: "Delivered",
    content_hash: "0x1b2c3d4e5f6a7b8c9d0e1f2a",
    timestamp: "09:14 AM",
    date: "2026-09-12",
    error: null
  },
  {
    request_id: "A101",
    service: "Compute",
    provider: "CloudNet",
    amount: 120.00,
    payment_tx: "0x6f5...4e3d",
    delivery_status: "Delivered",
    content_hash: "0x5a4b3c2d1e0f9e8d7c6b5a4b",
    timestamp: "Sep 11, 04:45 PM",
    date: "2026-09-11",
    error: null
  },
  {
    request_id: "A100",
    service: "Storage",
    provider: "FileDock",
    amount: 35.00,
    payment_tx: "0x9e8...7d6c",
    delivery_status: "Delivered",
    content_hash: "0x8f7e6d5c4b3a210987654321",
    timestamp: "Sep 11, 02:15 PM",
    date: "2026-09-11",
    error: null
  }
];

export const mockProviders = [
  {
    id: "p1",
    provider_id: "alpha",
    name: "Translation Alpha",
    service: "Translation",
    price: 0.005,
    currency: "ETH",
    quality: 94,
    qualityLabel: "94%",
    efficiency: 94,
    efficiencyLabel: "94%",
    rating: 4.9,
    responseTime: "50ms",
    responseTimeMs: 50,
    status: "Available",
    badge: "TOP QUALITY",
    description: "High-efficiency neural translation provider with maximum precision and fast speed.",
    endpoint: "http://localhost:8000/services/translate?provider_id=alpha"
  },
  {
    id: "p2",
    provider_id: "beta",
    name: "Translation Beta",
    service: "Translation",
    price: 0.003,
    currency: "ETH",
    quality: 67,
    qualityLabel: "67%",
    efficiency: 67,
    efficiencyLabel: "67%",
    rating: 4.6,
    responseTime: "120ms",
    responseTimeMs: 120,
    status: "Available",
    badge: "BALANCED",
    description: "Balanced translation service with 67% efficiency and optimal cost-speed ratio.",
    endpoint: "http://localhost:8000/services/translate?provider_id=beta"
  },
  {
    id: "p3",
    provider_id: "gamma",
    name: "Translation Gamma",
    service: "Translation",
    price: 0.001,
    currency: "ETH",
    quality: 45,
    qualityLabel: "45%",
    efficiency: 45,
    efficiencyLabel: "45%",
    rating: 4.2,
    responseTime: "250ms",
    responseTimeMs: 250,
    status: "Available",
    badge: "LOWEST PRICE",
    description: "Budget translation service with 45% efficiency and economical cost.",
    endpoint: "http://localhost:8000/services/translate?provider_id=gamma"
  }
];

export const mockAgentDetails = {
  name: "Payment Agent",
  status: "ONLINE",
  network: "Sepolia Testnet",
  totalBudget: "0.10",
  totalSpent: "0.0005",
  remainingBudget: "0.0995",
  currency: "ETH"
};

export const mockCurrentTask = {
  prompt: "Translate this document into Hindi",
  service: "Translation",
  provider: "Beta Cloud",
  requestedAmount: "0.00002 ETH",
  request_id: "A104",
  status: "Processing"
};

export const mockPipelineSteps = [
  {
    step: 1,
    id: "request",
    title: "Request Service",
    description: "Agent initiates HTTP request to provider endpoint",
    icon: "Send",
    timestamp: "12:31:02"
  },
  {
    step: 2,
    id: "provider",
    title: "Provider Found",
    description: "LinguaAI located; endpoint pinged",
    icon: "Search",
    timestamp: "12:31:03"
  },
  {
    step: 3,
    id: "payment_402",
    title: "402 Payment Required",
    description: "Provider returned HTTP 402 header & payment invoice",
    icon: "CreditCard",
    timestamp: "12:31:03"
  },
  {
    step: 4,
    id: "authorization",
    title: "Payment Authorization",
    description: "Agent submits payment authorization payload",
    icon: "KeyRound",
    timestamp: "12:31:04"
  },
  {
    step: 5,
    id: "smart_contract",
    title: "Smart Contract Check",
    description: "Enforced by Solidity Smart Contract (Hard cap cap check)",
    icon: "ShieldCheck",
    timestamp: "12:31:05"
  },
  {
    step: 6,
    id: "confirmed",
    title: "Payment Confirmed",
    description: "On-chain transaction minted (0x89f...3a1c)",
    icon: "CheckCircle",
    timestamp: "12:31:06"
  },
  {
    step: 7,
    id: "delivered",
    title: "Service Delivered",
    description: "Hindi translation payload returned & hash verified",
    icon: "FileCheck",
    timestamp: "12:31:07"
  }
];

export const mockAgentLogs = [
  { time: "12:31:02", text: "Agent initiated Translation request (#A104)" },
  { time: "12:31:03", text: "Provider Beta Cloud returned 402 Payment Required (0.00002 ETH)" },
  { time: "12:31:04", text: "Payment authorization requested for Request ID #A104" },
  { time: "12:31:05", text: "Smart contract verified spending limit (0.0005 ETH spent / 0.10 ETH cap)" },
  { time: "12:31:06", text: "Sepolia payment confirmed (Tx: 0x89f2a1...3a1c)" },
  { time: "12:31:07", text: "Service payload delivered successfully (Content Hash: 0x4e8d...)" }
];

export const mockRetryState = {
  attemptStatus: "Completed",
  networkState: "Timeout Detected",
  retryState: "Detected",
  request_id: "A104",
  additionalCharge: 0.00,
  statusMessage: "Duplicate payment prevented by smart contract on-chain state"
};

/**
 * Stage 2E — Centralized Mock Security System Model
 */
export const mockSecurityState = {
  protectionStatus: "Protection Active",
  hardCap: 500,
  totalSpent: 320,
  remainingBudget: 180,
  blockedAttempts: 2,
  duplicatePrevented: 0,
  currency: "₹",
  enforcementLayer: "Sepolia Solidity Smart Contract"
};

export const mockSecurityEvents = [
  {
    timestamp: "09/12/2026 12:31 PM",
    request_id: "A104",
    eventType: "Payment Authorized",
    amount: 50,
    status: "APPROVED",
    details: "Within hard cap (₹320 / ₹500 limit)"
  },
  {
    timestamp: "09/12/2026 12:34 PM",
    request_id: "A105",
    eventType: "Budget Exceeded",
    amount: 250,
    status: "BLOCKED",
    details: "Rejected by contract: Attempted ₹250 exceeds ₹180 remaining cap"
  },
  {
    timestamp: "09/12/2026 12:35 PM",
    request_id: "A104",
    eventType: "Duplicate Retry",
    amount: 0,
    status: "PREVENTED",
    details: "Duplicate payment prevented on-chain (Request #A104 state checked)"
  }
];

export const mockSpendingCapDemo = {
  blockedExample: {
    request_id: "A105",
    requestedAmount: 250,
    service: "Compute",
    provider: "ComputeX",
    availableBefore: 180,
    result: "PAYMENT BLOCKED",
    reason: "BUDGET_EXCEEDED",
    explanation: "The agent requested the payment, but the contract rejected it because the requested amount exceeds the remaining budget."
  },
  approvedExample: {
    request_id: "A104",
    requestedAmount: 50,
    service: "Translation",
    provider: "LinguaAI",
    availableBefore: 230,
    remainingAfter: 180,
    result: "APPROVED",
    statusText: "PAYMENT AUTHORIZED",
    explanation: "Authorization comes from the contract state."
  }
};

export const mockAgentVsContractComparison = {
  agentCapabilities: {
    title: "AI AGENT",
    can: [
      "Discover providers in marketplace",
      "Compare pricing & quality signals",
      "Choose a service provider",
      "Request payment for services",
      "Retry a failed network request"
    ],
    cannot: [
      "Increase the hard spending limit",
      "Override a smart contract rejection",
      "Spend beyond the hard budget cap",
      "Authorize its own unrestricted payment"
    ]
  },
  contractCapabilities: {
    title: "SMART CONTRACT / PAYMENT LAYER",
    controls: [
      "Hard spending limit enforcement",
      "Payment authorization execution",
      "Budget cap calculations on-chain",
      "Duplicate payment protection",
      "Immutable transaction state"
    ]
  }
};

export const mockSecurityGuarantees = [
  {
    id: 1,
    title: "Hard Spending Cap",
    description: "Payments above the remaining contract budget are rejected.",
    icon: "ShieldAlert"
  },
  {
    id: 2,
    title: "No Agent Fund Control",
    description: "The agent can request a payment but cannot directly authorize unrestricted spending.",
    icon: "Lock"
  },
  {
    id: 3,
    title: "Retry Protection",
    description: "Repeated requests do not create duplicate charges.",
    icon: "RefreshCw"
  },
  {
    id: 4,
    title: "Payment ≠ Delivery",
    description: "A successful payment does not automatically mean the service was delivered.",
    icon: "FileCheck2"
  },
  {
    id: 5,
    title: "Delivery Proof",
    description: "Delivered resources are linked to payment and content fingerprints.",
    icon: "KeyRound"
  }
];

/**
 * Stage 2F — Centralized Settings & User Profile Model
 */
export const mockSettings = {
  profile: {
    name: "Mayank Sharma",
    email: "alex@agentpay.io",
    role: "Agent Owner",
    status: "Active"
  },
  securityPreferences: {
    passwordLastUpdated: "3 days ago",
    twoFactorEnabled: false
  },
  notificationPreferences: {
    paymentConfirmations: true,
    paymentBlockedAlerts: true,
    deliveryNotifications: true,
    securityAlerts: true
  },
  agentSettings: {
    hardSpendingLimit: 500,
    totalSpent: 320,
    remainingBudget: 180,
    enforcement: "Smart Contract",
    status: "Protected"
  },
  connectionStatus: {
    frontend: "AgentPay Web",
    environment: import.meta.env.MODE || "Development",
    api: import.meta.env.VITE_API_BASE_URL || "Mock API",
    blockchain: "Mock / Sepolia Pending Integration"
  }
};
