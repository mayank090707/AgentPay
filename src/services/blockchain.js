/**
 * AgentPay Frontend — Blockchain Service Layer
 *
 * This module provides a clean interface to the AgentPay smart
 * contract deployed on Ethereum Sepolia Testnet (Chain ID 11155111).
 *
 * ARCHITECTURE:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  Read-only access  (JsonRpcProvider — no wallet required)    │
 *   │    getContractBudgetDetails()    getBudgetStatus()           │
 *   │    getBudget()                   getSpent()                  │
 *   │    getRemaining()                getContractBalance()        │
 *   │    getContractOwner()            getContractAgent()          │
 *   │    getHardCap()                  verifyAuditProof()          │
 *   │    verifyRetryProtection()       subscribeToContractEvents() │
 *   └──────────────────────────────────────────────────────────────┘
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  Owner Write access  (BrowserProvider — wallet signer needed)│
 *   │    getSignerContract()           executeSetBudget()          │
 *   │    executeFundContract()         executeWithdraw()           │
 *   │    switchEthereumNetwork()       decodeContractError()       │
 *   └──────────────────────────────────────────────────────────────┘
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  Person 2 / Person 3 Integration Boundary (Agent-Only)       │
 *   │    executeAgentAuthorizePayment()                            │
 *   │    executeAgentRecordDelivery()                              │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * IMPORTANT:
 *   - No private keys. No AGENT_PRIVATE_KEY. No DEPLOYER_PRIVATE_KEY.
 *   - Browser write actions request user signatures through window.ethereum.
 *   - authorizePayment() and recordDelivery() are restricted to the AI Agent.
 */

import { ethers } from 'ethers';
import { 
  BLOCKCHAIN_CONFIG, 
  SEPOLIA_CHAIN_ID, 
  isContractConfigured 
} from '../config/blockchain.config';
import { AGENT_PAY_ABI } from '../abi/index';

// ─────────────────────────────────────────────────────────────────────────────
// Internal: Provider & Contract Singletons
// ─────────────────────────────────────────────────────────────────────────────

/** Lazy-initialised read-only provider (JsonRpcProvider, no wallet needed) */
let _readProvider = null;

/** Lazy-initialised read-only contract instance */
let _readContract = null;

/**
 * Returns (and caches) the read-only JsonRpcProvider.
 * Uses the public RPC URL from VITE_PUBLIC_RPC_URL (or fallback).
 * @returns {ethers.JsonRpcProvider}
 */
export function getReadProvider() {
  if (!_readProvider) {
    _readProvider = new ethers.JsonRpcProvider(BLOCKCHAIN_CONFIG.publicRpcUrl);
  }
  return _readProvider;
}

/**
 * Returns (and caches) the read-only Contract instance connected
 * to the public JsonRpcProvider.
 * Returns null if contract address is not configured.
 * @returns {ethers.Contract|null}
 */
export function getReadContract() {
  if (!isContractConfigured()) {
    return null;
  }
  if (!_readContract) {
    _readContract = new ethers.Contract(
      BLOCKCHAIN_CONFIG.contractAddress,
      AGENT_PAY_ABI,
      getReadProvider()
    );
  }
  return _readContract;
}

/**
 * Returns a Contract instance connected to the connected browser wallet signer.
 * @returns {Promise<ethers.Contract>}
 */
export async function getSignerContract() {
  if (!isContractConfigured()) {
    throw new Error('Contract address is not configured. Set VITE_CONTRACT_ADDRESS in .env');
  }
  const browserProvider = getWalletProvider();
  const signer = await browserProvider.getSigner();
  return new ethers.Contract(
    BLOCKCHAIN_CONFIG.contractAddress,
    AGENT_PAY_ABI,
    signer
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: Network / Chain Validation & Wallet Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that the configured RPC endpoint is connected to Sepolia (11155111).
 * @returns {Promise<{ chainId: number, networkName: string }>}
 */
export async function validateNetwork() {
  const provider = getReadProvider();
  const network = await provider.getNetwork();
  const actualChainId = Number(network.chainId);
  const expectedChainId = BLOCKCHAIN_CONFIG.chainId;

  if (actualChainId !== expectedChainId) {
    throw new Error(
      `[AgentPay] Network mismatch: RPC is connected to chain ID ${actualChainId}, ` +
      `but VITE_CHAIN_ID expects ${expectedChainId} (Sepolia). ` +
      `Check your VITE_PUBLIC_RPC_URL environment variable.`
    );
  }

  return { chainId: actualChainId, networkName: BLOCKCHAIN_CONFIG.networkName };
}

/**
 * Returns a BrowserProvider wrapping window.ethereum.
 * Throws if no injected wallet is available.
 * @returns {ethers.BrowserProvider}
 */
export function getWalletProvider() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error(
      '[AgentPay] No injected wallet detected (window.ethereum is undefined). ' +
      'Install MetaMask or a compatible Web3 wallet.'
    );
  }
  return new ethers.BrowserProvider(window.ethereum);
}

/**
 * Returns the chain ID currently reported by the connected browser wallet.
 * @returns {Promise<number>}
 */
export async function getConnectedChainId() {
  const provider = getWalletProvider();
  const network = await provider.getNetwork();
  return Number(network.chainId);
}

/**
 * Returns true if the connected wallet is on the correct chain (Sepolia).
 * @returns {Promise<boolean>}
 */
export async function isOnCorrectChain() {
  try {
    const chainId = await getConnectedChainId();
    return chainId === SEPOLIA_CHAIN_ID;
  } catch {
    return false;
  }
}

/**
 * Requests the connected browser wallet to switch to Ethereum Sepolia Testnet.
 * If Sepolia is not configured in the wallet, requests adding the chain.
 * @returns {Promise<void>}
 */
export async function switchEthereumNetwork() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask or Web3 wallet is not available.');
  }

  const sepoliaHex = `0x${SEPOLIA_CHAIN_ID.toString(16)}`;

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: sepoliaHex }],
    });
  } catch (switchError) {
    if (switchError?.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: sepoliaHex,
            chainName: 'Ethereum Sepolia Testnet',
            nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: [BLOCKCHAIN_CONFIG.publicRpcUrl],
            blockExplorerUrls: [BLOCKCHAIN_CONFIG.blockExplorerUrl],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: Read-Only Contract Queries & Roles
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the address of the contract owner (owner() view method).
 * @returns {Promise<string|null>}
 */
export async function getContractOwner() {
  if (!isContractConfigured()) return null;
  try {
    const contract = getReadContract();
    if (!contract) return null;
    return await contract.owner();
  } catch (err) {
    console.warn('[AgentPay] getContractOwner failed:', err);
    return null;
  }
}

/**
 * Returns the address of the authorized agent (agent() view method).
 * @returns {Promise<string|null>}
 */
export async function getContractAgent() {
  if (!isContractConfigured()) return null;
  try {
    const contract = getReadContract();
    if (!contract) return null;
    return await contract.agent();
  } catch (err) {
    console.warn('[AgentPay] getContractAgent failed:', err);
    return null;
  }
}

/**
 * Returns the hard spending cap (getHardCap() view method).
 * @returns {Promise<{ wei: bigint, eth: string }|null>}
 */
export async function getHardCap() {
  if (!isContractConfigured()) return null;
  try {
    const contract = getReadContract();
    if (!contract) return null;
    const cap = await contract.getHardCap();
    return { wei: cap, eth: ethers.formatEther(cap) };
  } catch (err) {
    console.warn('[AgentPay] getHardCap failed:', err);
    return null;
  }
}

/**
 * Queries the smart contract for all budget dimensions in a single RPC call
 * using getBudgetStatus().
 *
 * Exact ABI signature: getBudgetStatus() -> (uint256 hardCap, uint256 budget, uint256 totalSpent, uint256 remaining)
 *
 * @returns {Promise<{
 *   hardCap: bigint, hardCapEth: string,
 *   budget: bigint, budgetEth: string,
 *   totalSpent: bigint, totalSpentEth: string,
 *   remaining: bigint, remainingEth: string,
 *   progressPercent: number,
 *   remainingPercent: number,
 *   enforcedByContract: boolean,
 *   network: string,
 *   contractAddress: string
 * } | null>}
 */
export async function getContractBudgetDetails() {
  if (!isContractConfigured()) {
    return null;
  }

  try {
    const contract = getReadContract();
    if (!contract) return null;

    const [hardCap, budget, totalSpent, remaining] = await contract.getBudgetStatus();

    let progressPercent = 0;
    let remainingPercent = 100;
    if (budget > 0n) {
      const spentScaled = (totalSpent * 10000n) / budget;
      progressPercent = Math.min(100, Math.max(0, Number(spentScaled) / 100));
      remainingPercent = Math.max(0, 100 - progressPercent);
    }

    return {
      hardCap,
      budget,
      totalSpent,
      remaining,
      hardCapEth: ethers.formatEther(hardCap),
      budgetEth: ethers.formatEther(budget),
      totalSpentEth: ethers.formatEther(totalSpent),
      remainingEth: ethers.formatEther(remaining),
      progressPercent: Math.round(progressPercent),
      remainingPercent: Math.round(remainingPercent),
      enforcedByContract: true,
      network: BLOCKCHAIN_CONFIG.networkName,
      contractAddress: BLOCKCHAIN_CONFIG.contractAddress,
    };
  } catch (error) {
    console.error('[AgentPay] getContractBudgetDetails failed:', error);
    throw error;
  }
}

/**
 * Direct call to contract getBudget() view method.
 * @returns {Promise<{ wei: bigint, eth: string } | null>}
 */
export async function getBudget() {
  if (!isContractConfigured()) return null;
  const contract = getReadContract();
  if (!contract) return null;
  const budget = await contract.getBudget();
  return { wei: budget, eth: ethers.formatEther(budget) };
}

/**
 * Direct call to contract getSpent() view method.
 * @returns {Promise<{ wei: bigint, eth: string } | null>}
 */
export async function getSpent() {
  if (!isContractConfigured()) return null;
  const contract = getReadContract();
  if (!contract) return null;
  const spent = await contract.getSpent();
  return { wei: spent, eth: ethers.formatEther(spent) };
}

/**
 * Direct call to contract getRemaining() view method.
 * @returns {Promise<{ wei: bigint, eth: string } | null>}
 */
export async function getRemaining() {
  if (!isContractConfigured()) return null;
  const contract = getReadContract();
  if (!contract) return null;
  const remaining = await contract.getRemaining();
  return { wei: remaining, eth: ethers.formatEther(remaining) };
}

/**
 * Returns the contract's current native ETH vault balance.
 * @returns {Promise<{ balance: bigint, balanceEth: string } | null>}
 */
export async function getContractBalance() {
  if (!isContractConfigured()) return null;
  try {
    const contract = getReadContract();
    if (!contract) return null;
    const balance = await contract.getContractBalance();
    return {
      balance,
      balanceEth: ethers.formatEther(balance),
    };
  } catch (error) {
    console.error('[AgentPay] getContractBalance failed:', error);
    throw error;
  }
}

/**
 * Checks whether a given requestId (bytes32 hex) has been processed on-chain.
 * @param {string} requestId
 * @returns {Promise<{ requestId: string, isAlreadyProcessed: boolean, contractAddress: string | null }>}
 */
export async function verifyRetryProtection(requestId) {
  if (!isContractConfigured()) {
    return {
      requestId,
      isAlreadyProcessed: false,
      contractAddress: null,
      statusMessage: 'Contract not configured on Sepolia',
    };
  }

  try {
    const contract = getReadContract();
    const isAlreadyProcessed = await contract.isProcessed(requestId);

    return {
      requestId,
      isAlreadyProcessed,
      contractAddress: BLOCKCHAIN_CONFIG.contractAddress,
      statusMessage: isAlreadyProcessed
        ? 'Duplicate payment prevented by smart contract on-chain state (isProcessed = true)'
        : 'Request ID has not been processed — payment is safe to proceed',
    };
  } catch (error) {
    console.error('[AgentPay] verifyRetryProtection failed:', error);
    throw error;
  }
}

/**
 * Checks if a requestId has been processed on-chain.
 * @param {string} requestId
 * @returns {Promise<boolean>}
 */
export async function isProcessed(requestId) {
  if (!isContractConfigured()) return false;
  const contract = getReadContract();
  if (!contract) return false;
  return await contract.isProcessed(requestId);
}

/**
 * Retrieves the full on-chain PaymentRecord for a given requestId.
 * @param {string} requestId
 * @returns {Promise<object|null>}
 */
export async function verifyAuditProof(requestId) {
  if (!isContractConfigured()) return null;

  try {
    const contract = getReadContract();
    if (!contract) return null;

    const isProcessedOnChain = await contract.isProcessed(requestId);
    if (!isProcessedOnChain) {
      return {
        requestId,
        isVerifiedOnChain: false,
        contractAddress: BLOCKCHAIN_CONFIG.contractAddress,
        reason: 'Request ID not found on-chain — payment was not processed',
      };
    }

    const record = await contract.getPayment(requestId);

    return {
      requestId: record.requestId,
      service: record.service,
      provider: record.provider,
      amountWei: record.amount,
      amountEth: ethers.formatEther(record.amount),
      contentHash: record.contentHash,
      paidAt: Number(record.paidAt),
      deliveredAt: Number(record.deliveredAt),
      delivered: record.delivered,
      isVerifiedOnChain: true,
      contractAddress: BLOCKCHAIN_CONFIG.contractAddress,
      paidAtISO: record.paidAt > 0n
        ? new Date(Number(record.paidAt) * 1000).toISOString()
        : null,
      deliveredAtISO: record.deliveredAt > 0n
        ? new Date(Number(record.deliveredAt) * 1000).toISOString()
        : null,
    };
  } catch (error) {
    console.error('[AgentPay] verifyAuditProof failed:', error);
    throw error;
  }
}

export async function getPayment(requestId) {
  return verifyAuditProof(requestId);
}

export async function getDeliveryHash(requestId) {
  if (!isContractConfigured()) return null;
  try {
    const contract = getReadContract();
    if (!contract) return null;
    const hash = await contract.getDeliveryHash(requestId);
    if (hash === ethers.ZeroHash) return null;
    return hash;
  } catch (error) {
    console.error('[AgentPay] getDeliveryHash failed:', error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: Owner Write Operations (Requires Connected Browser Wallet Signer)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decodes contract errors and custom revert signatures from AgentPay ABI.
 * @param {any} error
 * @returns {string} Human-readable explanation
 */
export function decodeContractError(error) {
  if (!error) return 'An unknown error occurred.';

  // Check if user rejected transaction
  if (
    error.code === 'ACTION_REJECTED' ||
    error.code === 4001 ||
    error?.message?.toLowerCase().includes('user rejected') ||
    error?.message?.toLowerCase().includes('user denied')
  ) {
    return 'Transaction was rejected in your wallet.';
  }

  // Try parsing custom error via contract interface
  const data = error?.data || error?.error?.data || error?.info?.error?.data;
  if (data && typeof data === 'string') {
    try {
      const iface = new ethers.Interface(AGENT_PAY_ABI);
      const parsed = iface.parseError(data);
      if (parsed) {
        switch (parsed.name) {
          case 'NotOwner':
            return 'Unauthorized: Caller is not the registered contract owner.';
          case 'NotAgent':
            return 'Unauthorized: Caller is not the registered AI Agent.';
          case 'AlreadyProcessed':
            return `Replay Protection: Request ${parsed.args?.requestId || ''} has already been processed and paid on-chain.`;
          case 'NotProcessed':
            return `Cannot record delivery: Request ${parsed.args?.requestId || ''} has not been paid.`;
          case 'AlreadyDelivered':
            return `Delivery proof has already been recorded on-chain for request ${parsed.args?.requestId || ''}.`;
          case 'BudgetBelowSpent':
            return `Budget cannot be lowered below current cumulative spent (${ethers.formatEther(parsed.args.spent)} ETH).`;
          case 'BudgetExceeded':
            return `Payment exceeds remaining autonomous budget (${ethers.formatEther(parsed.args.remaining)} ETH available).`;
          case 'BudgetExceedsHardCap':
            return `Budget exceeds the immutable lifetime cap (${ethers.formatEther(parsed.args.hardCap)} ETH).`;
          case 'HardCapExceeded':
            return `Payment exceeds remaining lifetime cap (${ethers.formatEther(parsed.args.hardCapRemaining)} ETH remaining).`;
          case 'InsufficientContractBalance':
            return `Contract balance insufficient: requested ${ethers.formatEther(parsed.args.requested)} ETH but only ${ethers.formatEther(parsed.args.available)} ETH is held in vault.`;
          case 'ZeroAmount':
            return 'Transaction amount must be greater than zero.';
          case 'ZeroAddress':
            return 'Provider address cannot be the zero address.';
          case 'EmptyService':
            return 'Service identifier cannot be empty.';
          case 'ZeroContentHash':
            return 'Content hash cannot be empty or zero.';
          case 'TransferFailed':
            return 'Native ETH transfer to the provider failed on-chain.';
          case 'ReentrancyGuardReentrantCall':
            return 'Security violation: Reentrant call prevented by ReentrancyGuard.';
          default:
            return `Contract reverted with error: ${parsed.name}`;
        }
      }
    } catch {
      // ignore parseError fallback
    }
  }

  if (error.reason) return error.reason;
  if (error.shortMessage) return error.shortMessage;
  if (error.message) return error.message;

  return 'Smart contract transaction failed.';
}

/**
 * Executes setBudget(uint256 amount) on the smart contract.
 * Caller MUST be the contract owner.
 *
 * @param {bigint} newBudgetWei - New operational budget in wei
 * @param {(status: { state: string, txHash?: string, receipt?: object, error?: string }) => void} [onStatusChange]
 * @returns {Promise<{ txHash: string, receipt: object }>}
 */
export async function executeSetBudget(newBudgetWei, onStatusChange) {
  try {
    onStatusChange?.({ state: 'VALIDATING' });

    const [budgetDetails, isCorrect] = await Promise.all([
      getContractBudgetDetails(),
      isOnCorrectChain()
    ]);

    if (!isCorrect) {
      throw new Error('Wallet must be connected to Ethereum Sepolia Testnet.');
    }

    if (budgetDetails) {
      if (newBudgetWei < budgetDetails.totalSpent) {
        throw new Error(`Budget cannot be set lower than cumulative spent (${budgetDetails.totalSpentEth} ETH).`);
      }
      if (newBudgetWei > budgetDetails.hardCap) {
        throw new Error(`Budget cannot exceed hard spending cap (${budgetDetails.hardCapEth} ETH).`);
      }
    }

    onStatusChange?.({ state: 'AWAITING_SIGNATURE' });

    const contract = await getSignerContract();
    const tx = await contract.setBudget(newBudgetWei);

    onStatusChange?.({ state: 'PENDING', txHash: tx.hash });

    const receipt = await tx.wait();
    onStatusChange?.({ state: 'CONFIRMED', txHash: tx.hash, receipt });

    return { txHash: tx.hash, receipt };
  } catch (error) {
    const decoded = decodeContractError(error);
    onStatusChange?.({ state: 'FAILED', error: decoded });
    throw new Error(decoded);
  }
}

/**
 * Executes payable fund() on the smart contract to deposit ETH into the vault.
 *
 * @param {bigint} amountWei - Native ETH amount in wei to deposit
 * @param {(status: { state: string, txHash?: string, receipt?: object, error?: string }) => void} [onStatusChange]
 * @returns {Promise<{ txHash: string, receipt: object }>}
 */
export async function executeFundContract(amountWei, onStatusChange) {
  try {
    if (amountWei <= 0n) {
      throw new Error('Deposit amount must be greater than zero.');
    }

    onStatusChange?.({ state: 'VALIDATING' });

    const isCorrect = await isOnCorrectChain();
    if (!isCorrect) {
      throw new Error('Wallet must be connected to Ethereum Sepolia Testnet.');
    }

    onStatusChange?.({ state: 'AWAITING_SIGNATURE' });

    const contract = await getSignerContract();
    const tx = await contract.fund({ value: amountWei });

    onStatusChange?.({ state: 'PENDING', txHash: tx.hash });

    const receipt = await tx.wait();
    onStatusChange?.({ state: 'CONFIRMED', txHash: tx.hash, receipt });

    return { txHash: tx.hash, receipt };
  } catch (error) {
    const decoded = decodeContractError(error);
    onStatusChange?.({ state: 'FAILED', error: decoded });
    throw new Error(decoded);
  }
}

/**
 * Executes withdraw(uint256 amount) on the smart contract.
 * Caller MUST be the contract owner.
 *
 * @param {bigint} amountWei - Unspent native ETH amount in wei to withdraw
 * @param {(status: { state: string, txHash?: string, receipt?: object, error?: string }) => void} [onStatusChange]
 * @returns {Promise<{ txHash: string, receipt: object }>}
 */
export async function executeWithdraw(amountWei, onStatusChange) {
  try {
    if (amountWei <= 0n) {
      throw new Error('Withdrawal amount must be greater than zero.');
    }

    onStatusChange?.({ state: 'VALIDATING' });

    const [balanceData, isCorrect] = await Promise.all([
      getContractBalance(),
      isOnCorrectChain()
    ]);

    if (!isCorrect) {
      throw new Error('Wallet must be connected to Ethereum Sepolia Testnet.');
    }

    if (balanceData && amountWei > balanceData.balance) {
      throw new Error(`Withdrawal amount exceeds contract balance (${balanceData.balanceEth} ETH).`);
    }

    onStatusChange?.({ state: 'AWAITING_SIGNATURE' });

    const contract = await getSignerContract();
    const tx = await contract.withdraw(amountWei);

    onStatusChange?.({ state: 'PENDING', txHash: tx.hash });

    const receipt = await tx.wait();
    onStatusChange?.({ state: 'CONFIRMED', txHash: tx.hash, receipt });

    return { txHash: tx.hash, receipt };
  } catch (error) {
    const decoded = decodeContractError(error);
    onStatusChange?.({ state: 'FAILED', error: decoded });
    throw new Error(decoded);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: Person 2 & Person 3 Service Integration Boundaries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Service Boundary for Person 2 (AI Agent): authorizePayment
 *
 * NOTE: This function is called exclusively by the AI Agent backend
 * using the authorized agent wallet. It is NOT exposed to dashboard users.
 *
 * @param {object} params
 * @param {string} params.requestId - bytes32 hex string
 * @param {bigint} params.amountWei - payment in wei
 * @param {string} params.provider - recipient provider address
 * @param {string} params.service - service description
 * @param {ethers.Signer} params.signer - Agent signer
 * @returns {Promise<object>} transaction receipt
 */
export async function executeAgentAuthorizePayment({ requestId, amountWei, provider, service, signer }) {
  if (!signer) throw new Error('Agent signer instance is required for payment authorization.');
  const contract = new ethers.Contract(BLOCKCHAIN_CONFIG.contractAddress, AGENT_PAY_ABI, signer);
  const tx = await contract.authorizePayment(requestId, amountWei, provider, service);
  return await tx.wait();
}

/**
 * Service Boundary for Person 2 / Person 3: recordDelivery
 *
 * NOTE: Binds the cryptographic delivery hash to the paid request.
 * Called exclusively by the AI Agent backend.
 *
 * @param {object} params
 * @param {string} params.requestId - bytes32 hex string
 * @param {string} params.contentHash - bytes32 content digest
 * @param {ethers.Signer} params.signer - Agent signer
 * @returns {Promise<object>} transaction receipt
 */
export async function executeAgentRecordDelivery({ requestId, contentHash, signer }) {
  if (!signer) throw new Error('Agent signer instance is required for delivery recording.');
  const contract = new ethers.Contract(BLOCKCHAIN_CONFIG.contractAddress, AGENT_PAY_ABI, signer);
  const tx = await contract.recordDelivery(requestId, contentHash);
  return await tx.wait();
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: Event Subscriptions & Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function subscribeToContractEvents(handlers = {}) {
  if (!isContractConfigured()) {
    return () => {};
  }

  const contract = getReadContract();
  if (!contract) return () => {};

  const { onPaymentAuthorized, onDeliveryRecorded, onBudgetSet, onFunded } = handlers;

  if (onPaymentAuthorized) {
    contract.on('PaymentAuthorized', (requestId, service, provider, amount, totalSpent, remainingBudget, event) => {
      onPaymentAuthorized({
        requestId,
        service,
        provider,
        amountWei: amount,
        amountEth: ethers.formatEther(amount),
        totalSpentWei: totalSpent,
        totalSpentEth: ethers.formatEther(totalSpent),
        remainingBudgetWei: remainingBudget,
        remainingBudgetEth: ethers.formatEther(remainingBudget),
        txHash: event?.log?.transactionHash ?? null,
        blockNumber: event?.log?.blockNumber ?? null,
      });
    });
  }

  if (onDeliveryRecorded) {
    contract.on('DeliveryRecorded', (requestId, contentHash, event) => {
      onDeliveryRecorded({
        requestId,
        contentHash,
        txHash: event?.log?.transactionHash ?? null,
      });
    });
  }

  if (onBudgetSet) {
    contract.on('BudgetSet', (oldBudget, newBudget) => {
      onBudgetSet({
        oldBudgetWei: oldBudget,
        oldBudgetEth: ethers.formatEther(oldBudget),
        newBudgetWei: newBudget,
        newBudgetEth: ethers.formatEther(newBudget),
      });
    });
  }

  if (onFunded) {
    contract.on('Funded', (by, amount) => {
      onFunded({
        by,
        amountWei: amount,
        amountEth: ethers.formatEther(amount),
      });
    });
  }

  return function unsubscribe() {
    contract.removeAllListeners();
  };
}

export function isBytes32(str) {
  if (!str || typeof str !== 'string') return false;
  return /^0x[0-9a-fA-F]{64}$/.test(str.trim());
}

export function toRequestId(identifier) {
  return ethers.id(identifier);
}

export { BLOCKCHAIN_CONFIG, isContractConfigured };
