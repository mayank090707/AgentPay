/**
 * AgentPay — Production Configuration Loader
 *
 * Provides safe, production-grade resolution of:
 *   - CONTRACT_ADDRESS (environment-first, with explicit local fallback prevention)
 *   - ABI resolution using stable relative paths (avoids cwd assumptions)
 *   - Sepolia chain ID validation (fails fast if wrong network)
 *   - Zero secret exposure
 */

const path = require("path");
const fs = require("fs");
const { ethers } = require("ethers");
require("dotenv").config();

const LOCAL_HARDHAT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const SEPOLIA_CHAIN_ID = 11155111;

/**
 * Resolves contract address according to strict production priority:
 * 1. process.env.CONTRACT_ADDRESS (highest priority)
 * 2. If not in production: fallback to artifacts-export/deployment.json
 * 3. Otherwise: fails with "CONTRACT_ADDRESS is required for production deployment."
 */
function getContractConfig() {
  const isProduction = process.env.NODE_ENV === "production";
  let contractAddress = process.env.CONTRACT_ADDRESS;
  let source = "ENV (CONTRACT_ADDRESS)";

  if (!contractAddress) {
    if (isProduction) {
      throw new Error("CONTRACT_ADDRESS is required for production deployment.");
    }

    // Local/development fallback
    const deploymentPath = path.resolve(__dirname, "..", "artifacts-export", "deployment.json");
    if (fs.existsSync(deploymentPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
        if (metadata.contractAddress) {
          contractAddress = metadata.contractAddress;
          source = "FALLBACK (artifacts-export/deployment.json)";
        }
      } catch {
        // Fall through to error
      }
    }
  }

  if (!contractAddress) {
    throw new Error("CONTRACT_ADDRESS is required for production deployment.");
  }

  // Prevent local Hardhat address in production
  if (isProduction && contractAddress.toLowerCase() === LOCAL_HARDHAT_ADDRESS.toLowerCase()) {
    throw new Error("Local Hardhat address (0x5FbDB...) cannot be used in production.");
  }

  if (!ethers.isAddress(contractAddress) || contractAddress === ethers.ZeroAddress) {
    throw new Error(`Invalid contract address: "${contractAddress}" is not a valid non-zero EVM address.`);
  }

  const expectedChainId = process.env.CHAIN_ID
    ? parseInt(process.env.CHAIN_ID, 10)
    : SEPOLIA_CHAIN_ID;

  return {
    contractAddress: ethers.getAddress(contractAddress), // returns checksummed address
    source,
    isProduction,
    chainId: expectedChainId,
    rpcUrl: process.env.SEPOLIA_RPC_URL || null,
  };
}

/**
 * Loads the canonical contract ABI from artifacts-export/AgentPay.json
 * Uses __dirname to ensure stable resolution on Render or any environment.
 */
function loadAbi() {
  const abiPath = path.resolve(__dirname, "..", "artifacts-export", "AgentPay.json");
  if (!fs.existsSync(abiPath)) {
    throw new Error(
      `ABI artifact not found at: ${abiPath}. Run 'npm run build' or 'node scripts/exportAbi.js' first.`
    );
  }
  const artifact = JSON.parse(fs.readFileSync(abiPath, "utf8"));
  if (!artifact.abi || !Array.isArray(artifact.abi)) {
    throw new Error(`Invalid ABI structure in ${abiPath}`);
  }
  return artifact.abi;
}

/**
 * Validates connection to the Sepolia RPC provider and verifies chain ID.
 * Fails fast before attempting to send any transactions.
 */
async function validateNetworkConnection(rpcUrl = process.env.SEPOLIA_RPC_URL, expectedChainId = SEPOLIA_CHAIN_ID) {
  if (!rpcUrl) {
    throw new Error("SEPOLIA_RPC_URL is required for network validation.");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  const actualChainId = Number(network.chainId);

  if (actualChainId !== expectedChainId) {
    throw new Error(
      `Chain ID mismatch: connected to chain ID ${actualChainId}, expected ${expectedChainId} (Sepolia).`
    );
  }

  return { provider, chainId: actualChainId };
}

module.exports = {
  getContractConfig,
  loadAbi,
  validateNetworkConnection,
  SEPOLIA_CHAIN_ID,
  LOCAL_HARDHAT_ADDRESS,
};
