/**
 * AgentPay — Hardhat Deploy Script
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network sepolia
 *
 * Required .env variables:
 *   AGENT_ADDRESS          — EOA address of the AI agent (Person 2)
 *   HARD_SPENDING_CAP_WEI  — Max lifetime spend in wei (e.g. 10000000000000000 = 0.01 ETH)
 *   INITIAL_FUND_WEI       — ETH to send to the contract on deployment
 *   DEPLOYER_PRIVATE_KEY   — Deployer wallet private key
 *   SEPOLIA_RPC_URL        — RPC endpoint
 */

const path       = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config();
const hre        = require("hardhat");
const { ethers } = hre;
const fs         = require("fs");

async function main() {
  // ── 1. Read and validate environment configuration ───────────────────────
  const agentAddress = process.env.AGENT_ADDRESS;
  const capWei       = process.env.HARD_SPENDING_CAP_WEI || "10000000000000000"; // 0.01 ETH
  const fundWei      = process.env.INITIAL_FUND_WEI      || "10000000000000000"; // 0.01 ETH

  if (!agentAddress || agentAddress === "0x_AGENT_PUBLIC_ADDRESS_HERE") {
    throw new Error("❌ AGENT_ADDRESS is missing or unset in .env — see .env.example");
  }

  if (!ethers.isAddress(agentAddress)) {
    throw new Error(`❌ AGENT_ADDRESS "${agentAddress}" is not a valid EVM address.`);
  }

  const signers = await ethers.getSigners();
  if (!signers || signers.length === 0) {
    throw new Error("❌ No deployer signer available. Check DEPLOYER_PRIVATE_KEY in .env");
  }
  const [deployer] = signers;

  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  const totalRequiredWei = BigInt(fundWei) + ethers.parseEther("0.005"); // buffer for gas

  const networkInfo = await ethers.provider.getNetwork();
  const currentChainId = Number(networkInfo.chainId);

  console.log("────────────────────────────────────────────────────────────");
  console.log("  AgentPay — Deployment Pipeline");
  console.log("────────────────────────────────────────────────────────────");
  console.log("Network:              ", hre.network.name);
  console.log("Chain ID:             ", currentChainId);
  console.log("Deployer Address:     ", deployer.address);
  console.log("Deployer Balance:     ", ethers.formatEther(deployerBalance), "ETH");
  console.log("Authorized Agent:     ", agentAddress);
  console.log("Hard Spending Cap:    ", ethers.formatEther(capWei), "ETH (", capWei, "wei )");
  console.log("Initial Funding:      ", ethers.formatEther(fundWei), "ETH (", fundWei, "wei )");
  console.log("────────────────────────────────────────────────────────────");

  if (hre.network.name === "sepolia" && currentChainId !== 11155111) {
    throw new Error(`❌ Chain ID mismatch: connected to chain ID ${currentChainId}, expected 11155111 for Sepolia.`);
  }

  if (deployerBalance < totalRequiredWei) {
    throw new Error(
      `❌ Insufficient deployer balance: has ${ethers.formatEther(deployerBalance)} ETH, ` +
      `needs at least ~${ethers.formatEther(totalRequiredWei)} ETH for funding + gas.`
    );
  }

  // ── 2. Deploy Contract ───────────────────────────────────────────────────
  console.log("\n🚀 Submitting deployment transaction...");
  const Factory = await ethers.getContractFactory("AgentPay");
  const contract = await Factory.deploy(agentAddress, BigInt(capWei));

  const deployTx = contract.deploymentTransaction();
  console.log("Tx Hash:              ", deployTx.hash);
  console.log("Waiting for block confirmation...");

  const receipt = await deployTx.wait(1);
  const contractAddress = await contract.getAddress();

  console.log("✅ AgentPay deployed to:", contractAddress);
  console.log("Mined in Block:       ", receipt.blockNumber);

  // ── 3. Initial Funding ───────────────────────────────────────────────────
  let fundTxHash = null;
  if (BigInt(fundWei) > 0n) {
    console.log(`\n💰 Funding contract with ${ethers.formatEther(fundWei)} ETH...`);
    const fundTx = await contract.fund({ value: BigInt(fundWei) });
    const fundReceipt = await fundTx.wait(1);
    fundTxHash = fundTx.hash;
    console.log("✅ Contract funded in block", fundReceipt.blockNumber, "(tx:", fundTxHash, ")");
  }

  // ── 4. Verify On-Chain State ─────────────────────────────────────────────
  console.log("\n🔍 Verifying on-chain state...");
  const onChainCap       = await contract.hardSpendingCap();
  const onChainBudget    = await contract.budget();
  const onChainSpent     = await contract.totalSpent();
  const onChainRemaining = await contract.getRemaining();
  const onChainAgent     = await contract.agent();
  const onChainOwner     = await contract.owner();
  const onChainBalance   = await contract.getContractBalance();

  console.log("  Contract Owner:     ", onChainOwner);
  console.log("  Authorized Agent:   ", onChainAgent);
  console.log("  Hard Spending Cap:  ", ethers.formatEther(onChainCap), "ETH");
  console.log("  Current Budget:     ", ethers.formatEther(onChainBudget), "ETH");
  console.log("  Total Spent:        ", ethers.formatEther(onChainSpent), "ETH");
  console.log("  Remaining Budget:   ", ethers.formatEther(onChainRemaining), "ETH");
  console.log("  Contract Balance:   ", ethers.formatEther(onChainBalance), "ETH");

  // ── 5. Write artifacts-export/deployment.json ────────────────────────────
  const exportDir = path.join(__dirname, "..", "artifacts-export");
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

  const deploymentInfo = {
    contractAddress:        contractAddress,
    deployerAddress:        deployer.address,
    agentAddress:           agentAddress,
    network:                hre.network.name,
    chainId:                Number(networkInfo.chainId),
    hardSpendingCapWei:     capWei.toString(),
    hardSpendingCapEth:     ethers.formatEther(capWei),
    initialBudgetWei:       capWei.toString(),
    initialBudgetEth:       ethers.formatEther(capWei),
    initialFundWei:         fundWei.toString(),
    initialFundEth:         ethers.formatEther(fundWei),
    deploymentTxHash:       deployTx.hash,
    blockNumber:            receipt.blockNumber,
    fundTxHash:             fundTxHash,
    deployedAt:             new Date().toISOString(),
    etherscanUrl:           hre.network.name === "sepolia"
                              ? `https://sepolia.etherscan.io/address/${contractAddress}`
                              : null,
  };

  fs.writeFileSync(
    path.join(exportDir, "deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("✅ Written to:", path.join(exportDir, "deployment.json"));

  // ── 6. Sync ABI to artifacts-export/AgentPay.json ────────────────────────
  const artifactPath = path.join(
    __dirname, "..", "artifacts", "contracts", "AgentPay.sol", "AgentPay.json"
  );
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    fs.writeFileSync(
      path.join(exportDir, "AgentPay.json"),
      JSON.stringify({ abi: artifact.abi }, null, 2)
    );
    console.log("✅ ABI synced to:", path.join(exportDir, "AgentPay.json"));
  }

  console.log("────────────────────────────────────────────────────────────");
  console.log("🎉 DEPLOYMENT COMPLETE & VERIFIED ON-CHAIN!");
  if (deploymentInfo.etherscanUrl) {
    console.log("Etherscan:", deploymentInfo.etherscanUrl);
  }
  console.log("────────────────────────────────────────────────────────────");

  return deploymentInfo;
}

if (require.main === module) {
  main().catch((err) => {
    console.error("❌ Deployment failed:", err.message);
    process.exitCode = 1;
  });
}

module.exports = main;
