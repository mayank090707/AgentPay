/**
 * AgentPay — Person 2 (AI Agent) & Person 3 (Service Provider) Integration Boundary
 *
 * ARCHITECTURAL SPECIFICATION (Phase 4):
 *   ┌────────────────────────┐         ┌─────────────────────────┐
 *   │  Person 2: AI Agent    │         │  Person 3: Provider     │
 *   │  (Holds Agent Key      │         │  (Delivers Service &    │
 *   │   on secure backend)   │         │   computes ContentHash) │
 *   └──────────┬─────────────┘         └───────────┬─────────────┘
 *              │                                   │
 *              │ 1. HTTP 402 Payment Request       │
 *              │    (Provider, Cost, RequestId)    │
 *              ├──────────────────────────────────►│
 *              │                                   │
 *              │ 2. Pre-flight Idempotency Check   │
 *              │    isProcessed(requestId)         │
 *              │                                   │
 *              │ 3. authorizePayment(reqId, ...)   │
 *              │    (ETH transfer on Sepolia)      │
 *              │                                   │
 *              │ 4. HTTP 200 + Content Payload     │
 *              │◄──────────────────────────────────┤
 *              │                                   │
 *              │ 5. Compute deterministic          │
 *              │    contentHash                    │
 *              │                                   │
 *              │ 6. recordDelivery(reqId, hash)    │
 *              │    (Cryptographic proof on-chain) │
 *              ▼                                   ▼
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │      AgentPay Smart Contract on Sepolia (Chain 11155111)     │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * CRITICAL SECURITY INVARIANTS:
 * 1. The frontend NEVER receives, imports, or stores AGENT_PRIVATE_KEY.
 * 2. Connected dashboard wallets cannot sign authorizePayment or recordDelivery
 *    because the contract strictly enforces onlyAgent.
 * 3. Request IDs are strictly canonical 32-byte hashes (keccak256(UUID)).
 * 4. Replay Protection is authoritative: The exact same requestId is preserved
 *    during retry attempts. Retrying an already-paid requestId reverts with
 *    AlreadyProcessed(requestId).
 */

import { ethers } from 'ethers';
import { AGENT_PAY_ABI } from '../abi/index';
import { BLOCKCHAIN_CONFIG, isContractConfigured } from '../config/blockchain.config';
import { decodeContractError, isBytes32 } from './blockchain';

// ── Validation Helpers ────────────────────────────────────────────────────────

/**
 * Validates a payment request according to AgentPay contract rules.
 *
 * @param {object} params
 * @param {string} params.requestId - bytes32 hex string
 * @param {bigint} params.amountWei - payment in wei
 * @param {string} params.provider - recipient provider EVM address
 * @param {string} params.service - human-readable service identifier
 */
export function validatePaymentRequest({ requestId, amountWei, provider, service }) {
  if (!isBytes32(requestId)) {
    throw new Error(`Invalid Request ID "${requestId}": must be a 0x-prefixed 32-byte hex string (keccak256).`);
  }
  if (!amountWei || typeof amountWei !== 'bigint' || amountWei <= 0n) {
    throw new Error('Payment amount must be a positive BigInt in wei.');
  }
  if (!provider || !/^0x[0-9a-fA-F]{40}$/.test(provider) || provider === ethers.ZeroAddress) {
    throw new Error(`Invalid provider address "${provider}": cannot be zero address and must be a valid EVM address.`);
  }
  if (!service || typeof service !== 'string' || service.trim() === '') {
    throw new Error('Service identifier cannot be empty.');
  }
  return true;
}

/**
 * Validates a delivery recording request according to AgentPay contract rules.
 *
 * @param {object} params
 * @param {string} params.requestId - bytes32 hex string
 * @param {string} params.contentHash - bytes32 content digest
 */
export function validateDeliveryRequest({ requestId, contentHash }) {
  if (!isBytes32(requestId)) {
    throw new Error(`Invalid Request ID "${requestId}": must be a 0x-prefixed 32-byte hex string.`);
  }
  if (!isBytes32(contentHash) || contentHash === ethers.ZeroHash) {
    throw new Error(`Invalid contentHash "${contentHash}": must be a non-zero 32-byte hex digest.`);
  }
  return true;
}

// ── Person 2 (AI Agent) Client Functions ──────────────────────────────────────

/**
 * Pre-flight Idempotency Check: Queries whether a requestId has already been processed.
 * Used by Person 2 AI Agent before submitting authorizePayment.
 *
 * @param {string} requestId - bytes32 hex string
 * @param {ethers.Contract} [contractInstance] - Optional contract instance
 * @returns {Promise<{ alreadyProcessed: boolean, safeToProceed: boolean }>}
 */
export async function checkBeforePay(requestId, contractInstance) {
  if (!isBytes32(requestId)) {
    return { alreadyProcessed: false, safeToProceed: false, reason: 'Invalid bytes32 requestId' };
  }

  const contract = contractInstance || (
    isContractConfigured() 
      ? new ethers.Contract(BLOCKCHAIN_CONFIG.contractAddress, AGENT_PAY_ABI, new ethers.JsonRpcProvider(BLOCKCHAIN_CONFIG.publicRpcUrl))
      : null
  );

  if (!contract) {
    throw new Error('Contract instance not available. Configure VITE_CONTRACT_ADDRESS.');
  }

  const alreadyProcessed = await contract.isProcessed(requestId);

  return {
    alreadyProcessed,
    safeToProceed: !alreadyProcessed,
    statusMessage: alreadyProcessed
      ? 'Request already paid on-chain. Skipping authorizePayment to prevent double charge.'
      : 'Request has not been processed. Safe to proceed with payment.'
  };
}

/**
 * Executes authorizePayment on the smart contract using the authorized agent signer.
 *
 * NOTE: This function is executed by the Person 2 AI Agent backend.
 * The signer MUST be the registered agent address.
 *
 * REPLAY RULE: The same logical purchase MUST reuse the same requestId on retry.
 * The contract enforces AlreadyProcessed(requestId).
 *
 * @param {object} params
 * @param {string} params.requestId - Canonical bytes32 requestId (preserved on retry)
 * @param {bigint} params.amountWei - Payment amount in wei
 * @param {string} params.provider - Service provider recipient address
 * @param {string} params.service - Description of service purchased
 * @param {ethers.Signer} params.agentSigner - Authorized Agent EOA signer
 * @param {string} [params.contractAddress] - Optional override contract address
 * @returns {Promise<{ txHash: string, receipt: object, blockNumber: number }>}
 */
export async function authorizeAgentPayment({
  requestId,
  amountWei,
  provider,
  service,
  agentSigner,
  contractAddress
}) {
  if (!agentSigner) {
    throw new Error('[Person 2 AgentPay] agentSigner instance is required. Signers must reside on the secure backend.');
  }

  // 1. Parameter Validation
  validatePaymentRequest({ requestId, amountWei, provider, service });

  const targetAddress = contractAddress || BLOCKCHAIN_CONFIG.contractAddress;
  const contract = new ethers.Contract(targetAddress, AGENT_PAY_ABI, agentSigner);

  // 2. Pre-flight Idempotency Check
  const idempotency = await checkBeforePay(requestId, contract);
  if (idempotency.alreadyProcessed) {
    throw new Error(`[AlreadyProcessed] Request ${requestId} has already been paid on-chain.`);
  }

  // 3. Pre-flight Budget Limit Check
  const remaining = await contract.getRemaining();
  if (amountWei > remaining) {
    throw new Error(
      `[BudgetExceeded] Payment of ${ethers.formatEther(amountWei)} ETH exceeds remaining budget (${ethers.formatEther(remaining)} ETH).`
    );
  }

  // 4. Pre-flight Contract Balance Check
  const vaultBalance = await contract.getContractBalance();
  if (amountWei > vaultBalance) {
    throw new Error(
      `[InsufficientContractBalance] Contract vault holds ${ethers.formatEther(vaultBalance)} ETH, but ${ethers.formatEther(amountWei)} ETH is required.`
    );
  }

  // 5. Submit Transaction with Agent Signer
  try {
    const tx = await contract.authorizePayment(requestId, amountWei, provider, service.trim());
    const receipt = await tx.wait(1);

    return {
      txHash: tx.hash,
      receipt,
      blockNumber: receipt.blockNumber,
      requestId,
      amountWei,
      amountEth: ethers.formatEther(amountWei),
      provider,
      service,
    };
  } catch (error) {
    const decoded = decodeContractError(error);
    throw new Error(`[authorizePayment Failed] ${decoded}`);
  }
}

// ── Person 3 (Service Provider) Delivery Functions ────────────────────────────

/**
 * Derives a deterministic 32-byte content hash from a service response payload.
 * Follows the project standard: keccak256(utf8Bytes(canonicalPayload)).
 *
 * @param {string|object} payload - The service output payload (JSON string or object)
 * @returns {string} 0x-prefixed 32-byte hex digest
 */
export function generateServiceContentHash(payload) {
  if (!payload) {
    throw new Error('Service response payload is required to generate content hash.');
  }

  let canonicalString;
  if (typeof payload === 'string') {
    canonicalString = payload.trim();
  } else {
    // Canonical JSON stringification (sorted keys)
    canonicalString = JSON.stringify(payload, Object.keys(payload).sort());
  }

  return ethers.keccak256(ethers.toUtf8Bytes(canonicalString));
}

/**
 * Verifies on-chain that Person 2 paid the requestId before Person 3 delivers the service.
 *
 * @param {string} requestId - bytes32 hex string
 * @param {ethers.Contract} [contractInstance]
 * @returns {Promise<{ isPaid: boolean, paymentRecord: object|null }>}
 */
export async function verifyPaymentReceived(requestId, contractInstance) {
  if (!isBytes32(requestId)) {
    return { isPaid: false, paymentRecord: null };
  }

  const contract = contractInstance || (
    isContractConfigured()
      ? new ethers.Contract(BLOCKCHAIN_CONFIG.contractAddress, AGENT_PAY_ABI, new ethers.JsonRpcProvider(BLOCKCHAIN_CONFIG.publicRpcUrl))
      : null
  );

  if (!contract) return { isPaid: false, paymentRecord: null };

  const isPaid = await contract.isProcessed(requestId);
  if (!isPaid) {
    return { isPaid: false, paymentRecord: null };
  }

  const record = await contract.getPayment(requestId);
  return {
    isPaid: true,
    paymentRecord: {
      requestId: record.requestId,
      service: record.service,
      provider: record.provider,
      amountWei: record.amount,
      amountEth: ethers.formatEther(record.amount),
      paidAt: Number(record.paidAt),
      delivered: record.delivered,
      contentHash: record.contentHash,
    },
  };
}

/**
 * Records delivery proof on-chain (recordDelivery).
 * Called by Person 2 AI Agent holding the authorized agent signer after receiving output from Person 3.
 *
 * @param {object} params
 * @param {string} params.requestId - Canonical bytes32 requestId
 * @param {string} params.contentHash - Deterministic bytes32 content digest
 * @param {ethers.Signer} params.agentSigner - Authorized Agent EOA signer
 * @param {string} [params.contractAddress] - Optional override address
 * @returns {Promise<{ txHash: string, receipt: object, blockNumber: number }>}
 */
export async function recordAgentDelivery({
  requestId,
  contentHash,
  agentSigner,
  contractAddress
}) {
  if (!agentSigner) {
    throw new Error('[Person 2 AgentPay] agentSigner instance is required.');
  }

  validateDeliveryRequest({ requestId, contentHash });

  const targetAddress = contractAddress || BLOCKCHAIN_CONFIG.contractAddress;
  const contract = new ethers.Contract(targetAddress, AGENT_PAY_ABI, agentSigner);

  // Pre-flight check: must be paid
  const isPaid = await contract.isProcessed(requestId);
  if (!isPaid) {
    throw new Error(`[NotProcessed] Cannot record delivery: Request ${requestId} has not been paid on-chain.`);
  }

  // Pre-flight check: delivery not already recorded
  const existingHash = await contract.getDeliveryHash(requestId);
  if (existingHash !== ethers.ZeroHash) {
    throw new Error(`[AlreadyDelivered] Delivery proof has already been recorded on-chain for request ${requestId}.`);
  }

  try {
    const tx = await contract.recordDelivery(requestId, contentHash);
    const receipt = await tx.wait(1);

    return {
      txHash: tx.hash,
      receipt,
      blockNumber: receipt.blockNumber,
      requestId,
      contentHash,
    };
  } catch (error) {
    const decoded = decodeContractError(error);
    throw new Error(`[recordDelivery Failed] ${decoded}`);
  }
}
