/**
 * AgentPay Frontend — Blockchain Configuration
 *
 * Reads exclusively from Vite environment variables (VITE_* prefix).
 * No hardcoded addresses. No private keys. No secrets.
 *
 * Required environment variables (set in .env):
 *   VITE_CONTRACT_ADDRESS  — Deployed AgentPay contract on Sepolia
 *   VITE_CHAIN_ID          — Must be 11155111 (Sepolia)
 *
 * Optional:
 *   VITE_PUBLIC_RPC_URL     — Public Sepolia RPC endpoint (no private key)
 *   VITE_BLOCK_EXPLORER_URL — Default: https://sepolia.etherscan.io
 *
 * LAZY GETTER PATTERN:
 *   All properties on BLOCKCHAIN_CONFIG are evaluated lazily (on first access).
 *   This means the module can be safely imported at build time even when .env
 *   is absent. The config error is deferred to runtime (first RPC call),
 *   giving the developer a clear message in the browser console.
 */

// ── Constants ─────────────────────────────────────────────────────────────────
export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_NETWORK_NAME = 'Ethereum Sepolia Testnet';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// ── Public Validation Helpers ─────────────────────────────────────────────────

/**
 * Validates that a string is a plausible non-zero EVM address.
 * @param {string|undefined} addr
 * @returns {boolean}
 */
export function isValidEVMAddress(addr) {
  if (!addr || typeof addr !== 'string') return false;
  if (addr.toLowerCase() === ZERO_ADDRESS.toLowerCase()) return false;
  return /^0x[0-9a-fA-F]{40}$/.test(addr.trim());
}

/**
 * Returns true if VITE_CONTRACT_ADDRESS is set to a valid non-zero EVM address
 * and is not an unreplaced placeholder like "0x<...>".
 * @returns {boolean}
 */
export function isContractConfigured() {
  const raw = import.meta.env.VITE_CONTRACT_ADDRESS;
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed.includes('<') || trimmed.includes('>')) return false;
  return isValidEVMAddress(trimmed);
}

/**
 * Resolves and validates the contract address from VITE_CONTRACT_ADDRESS.
 * If safe: true, returns null when unconfigured instead of throwing.
 * @param {{ safe?: boolean }} options
 * @returns {string|null}
 */
export function resolveContractAddress({ safe = false } = {}) {
  const raw = import.meta.env.VITE_CONTRACT_ADDRESS;

  if (!raw || raw.trim() === '' || raw.includes('<') || raw.includes('>')) {
    if (safe) return null;
    throw new Error(
      '[AgentPay Config] VITE_CONTRACT_ADDRESS is not set.\n' +
      'Add it to your .env file:\n' +
      '  VITE_CONTRACT_ADDRESS=0x<your_deployed_sepolia_address>\n' +
      'Copy .env.example to .env and fill in the deployed contract address.'
    );
  }

  const trimmed = raw.trim();

  if (!isValidEVMAddress(trimmed)) {
    if (safe) return null;
    throw new Error(
      `[AgentPay Config] VITE_CONTRACT_ADDRESS "${trimmed}" is not a valid non-zero EVM address.\n` +
      'It must be 0x followed by exactly 40 hexadecimal characters.\n' +
      'Get the address from: Blockchain/artifacts-export/deployment.json → contractAddress'
    );
  }

  return trimmed;
}

/**
 * Resolves the expected chain ID from VITE_CHAIN_ID.
 * Defaults to Sepolia (11155111) if not explicitly set.
 * @returns {number}
 */
export function resolveChainId() {
  const raw = import.meta.env.VITE_CHAIN_ID;
  if (!raw) return SEPOLIA_CHAIN_ID;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error(
      `[AgentPay Config] VITE_CHAIN_ID "${raw}" is not a valid chain ID.\n` +
      'Set VITE_CHAIN_ID=11155111 for Sepolia.'
    );
  }
  return parsed;
}

// ── Exported Config (Lazy Getters) ────────────────────────────────────────────

/**
 * Blockchain configuration object for the AgentPay frontend.
 *
 * Each property is a lazy getter — evaluated on first access at runtime,
 * not at module import time. This ensures the build succeeds without .env.
 */
export const BLOCKCHAIN_CONFIG = {
  /** Returns true if VITE_CONTRACT_ADDRESS is properly configured */
  get isConfigured()     { return isContractConfigured(); },
  /** Validated Sepolia contract address (throws if unconfigured) */
  get contractAddress()  { return resolveContractAddress({ safe: false }); },
  /** Safe contract address getter (returns null if unconfigured) */
  get safeContractAddress() { return resolveContractAddress({ safe: true }); },
  /** Expected chain ID (default: 11155111) from VITE_CHAIN_ID */
  get chainId()          { return resolveChainId(); },
  /** Human-readable network name */
  get networkName()      { return SEPOLIA_NETWORK_NAME; },
  /** Public read-only RPC URL — safe to bundle (no private key) */
  get publicRpcUrl()     { return import.meta.env.VITE_PUBLIC_RPC_URL || 'https://rpc.sepolia.org'; },
  /** Etherscan block explorer base URL */
  get blockExplorerUrl() { return import.meta.env.VITE_BLOCK_EXPLORER_URL || 'https://sepolia.etherscan.io'; },
};

// ── URL Helpers ───────────────────────────────────────────────────────────────

/**
 * Builds a full Etherscan URL for a transaction hash.
 * @param {string} txHash
 * @returns {string}
 */
export function getTxUrl(txHash) {
  return `${BLOCKCHAIN_CONFIG.blockExplorerUrl}/tx/${txHash}`;
}

/**
 * Builds a full Etherscan URL for an address.
 * @param {string} address
 * @returns {string}
 */
export function getAddressUrl(address) {
  return `${BLOCKCHAIN_CONFIG.blockExplorerUrl}/address/${address}`;
}
