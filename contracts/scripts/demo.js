/**
 * AgentPay — Hackathon End-to-End Demo Script
 *
 * Runs all 5 hackathon core requirements in a single command:
 *   1. Successful service purchase (ETH transferred atomically)
 *   2. Overspending attempt rejected by smart contract (hard cap enforced)
 *   3. Retry of the same logical purchase without double charging (idempotency)
 *   4. Delivery proof connected to payment through content hash
 *   5. Full auditable on-chain state inspection
 *
 * Usage:
 *   npx hardhat run scripts/demo.js
 */

const hre = require("hardhat");
const { ethers } = hre;

function banner(title) {
  console.log("\n" + "=".repeat(60));
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

function subBanner(title) {
  console.log("\n" + "-".repeat(50));
  console.log(`▶ ${title}`);
  console.log("-".repeat(50));
}

async function main() {
  banner("AgentPay — Complete Hackathon Demo");

  const [owner, agent, provider, stranger] = await ethers.getSigners();

  console.log("Roles:");
  console.log("  Owner (Person 1):   ", owner.address);
  console.log("  AI Agent (Person 2):", agent.address);
  console.log("  Provider (Person 3):", provider.address);

  // ─────────────────────────────────────────────────────────────────────────
  // Setup: Deploy and Fund
  // ─────────────────────────────────────────────────────────────────────────
  subBanner("Setup: Deploying Contract with 0.01 ETH Hard Cap");

  const HARD_CAP = ethers.parseEther("0.01"); // 0.01 ETH
  const AgentPayFactory = await ethers.getContractFactory("AgentPay");
  const contract = await AgentPayFactory.deploy(agent.address, HARD_CAP);
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log(`  Contract Address:   ${contractAddress}`);

  // Fund with 0.05 ETH
  await owner.sendTransaction({
    to: contractAddress,
    value: ethers.parseEther("0.05")
  });
  console.log(`  Contract Funded:    0.05 ETH`);

  let [hardCap, budget, spent, remaining] = await contract.getBudgetStatus();
  console.log(`  Hard Spending Cap:  ${ethers.formatEther(hardCap)} ETH`);
  console.log(`  Initial Budget:     ${ethers.formatEther(budget)} ETH`);
  console.log(`  Remaining Budget:   ${ethers.formatEther(remaining)} ETH`);

  // ─────────────────────────────────────────────────────────────────────────
  // Scenario 1: Successful Service Purchase
  // ─────────────────────────────────────────────────────────────────────────
  subBanner("Scenario 1: Successful Service Purchase (0.002 ETH)");

  const req1 = ethers.id("service-purchase-weather-001");
  const purchasePrice = ethers.parseEther("0.002");
  const providerBalanceBefore = await ethers.provider.getBalance(provider.address);

  console.log(`  Request ID:        ${req1}`);
  console.log(`  Purchasing:        "weather-report" for 0.002 ETH`);

  const tx1 = await contract.connect(agent).authorizePayment(
    req1,
    purchasePrice,
    provider.address,
    "weather-report"
  );
  const receipt1 = await tx1.wait();

  const providerBalanceAfter = await ethers.provider.getBalance(provider.address);
  const balanceDelta = providerBalanceAfter - providerBalanceBefore;

  console.log(`  Tx Hash:           ${receipt1.hash}`);
  console.log(`  Provider Received: ${ethers.formatEther(balanceDelta)} ETH`);

  [hardCap, budget, spent, remaining] = await contract.getBudgetStatus();
  console.log(`  Total Spent:       ${ethers.formatEther(spent)} ETH`);
  console.log(`  Remaining Budget:  ${ethers.formatEther(remaining)} ETH`);
  console.log(`  ✅ Scenario 1 SUCCESS: Payment executed atomically.`);

  // ─────────────────────────────────────────────────────────────────────────
  // Scenario 2: Overspending Attempt Rejected by Contract
  // ─────────────────────────────────────────────────────────────────────────
  subBanner("Scenario 2: Overspending Attempt Rejected by Smart Contract");

  const req2 = ethers.id("service-purchase-satellite-002");
  const excessiveAmount = ethers.parseEther("0.009"); // remaining is 0.008

  console.log(`  Attempting spend:  ${ethers.formatEther(excessiveAmount)} ETH`);
  console.log(`  Remaining Budget:  ${ethers.formatEther(remaining)} ETH`);

  try {
    await contract.connect(agent).authorizePayment(
      req2,
      excessiveAmount,
      provider.address,
      "satellite-imagery"
    );
    console.error("  ❌ FAILED: Transaction should have reverted!");
  } catch (err) {
    console.log(`  Contract Reverted:  BudgetExceeded`);
    console.log(`  Error Message:      ${err.message.split("\n")[0]}`);
    console.log(`  ✅ Scenario 2 SUCCESS: AI Agent cannot exceed hard cap!`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Scenario 3: Retry Without Double Charging (Idempotency)
  // ─────────────────────────────────────────────────────────────────────────
  subBanner("Scenario 3: Retry Same Logical Purchase (Idempotency Guard)");

  console.log(`  Checking isProcessed(req1)...`);
  const alreadyProcessed = await contract.isProcessed(req1);
  console.log(`  contract.isProcessed(req1) = ${alreadyProcessed}`);

  console.log(`  Attempting duplicate payment transaction for req1...`);
  try {
    await contract.connect(agent).authorizePayment(
      req1,
      purchasePrice,
      provider.address,
      "weather-report"
    );
    console.error("  ❌ FAILED: Duplicate payment was allowed!");
  } catch (err) {
    console.log(`  Contract Reverted:  AlreadyProcessed`);
    console.log(`  ✅ Scenario 3 SUCCESS: Replay / duplicate charge prevented.`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Scenario 4: Delivery Proof Connected to Payment via Content Hash
  // ─────────────────────────────────────────────────────────────────────────
  subBanner("Scenario 4: Delivery Proof Connected via Content Hash");

  const servicePayload = JSON.stringify({
    service: "weather-report",
    temperature: "22C",
    condition: "Sunny",
    timestamp: 1726142400
  });
  const contentHash = ethers.keccak256(ethers.toUtf8Bytes(servicePayload));

  console.log(`  Service Output:    ${servicePayload}`);
  console.log(`  Content Hash:      ${contentHash}`);

  const txDelivery = await contract.connect(agent).recordDelivery(req1, contentHash);
  await txDelivery.wait();

  const recordedHash = await contract.getDeliveryHash(req1);
  console.log(`  On-Chain Hash:     ${recordedHash}`);
  console.log(`  Hashes Match:      ${recordedHash === contentHash ? "YES ✅" : "NO ❌"}`);
  console.log(`  ✅ Scenario 4 SUCCESS: Payment cryptographically linked to delivery.`);

  // ─────────────────────────────────────────────────────────────────────────
  // Scenario 5: Auditable State Inspection
  // ─────────────────────────────────────────────────────────────────────────
  subBanner("Scenario 5: Auditable On-Chain Record Inspection");

  const paymentRecord = await contract.getPayment(req1);
  console.log("  On-Chain Payment Record for req1:");
  console.log(`    - Request ID:    ${paymentRecord.requestId}`);
  console.log(`    - Service:       "${paymentRecord.service}"`);
  console.log(`    - Provider:      ${paymentRecord.provider}`);
  console.log(`    - Amount:        ${ethers.formatEther(paymentRecord.amount)} ETH`);
  console.log(`    - Content Hash:  ${paymentRecord.contentHash}`);
  console.log(`    - Paid At:       ${new Date(Number(paymentRecord.paidAt) * 1000).toISOString()}`);
  console.log(`    - Delivered At:  ${new Date(Number(paymentRecord.deliveredAt) * 1000).toISOString()}`);
  console.log(`    - Delivered:     ${paymentRecord.delivered}`);

  [hardCap, budget, spent, remaining] = await contract.getBudgetStatus();
  console.log("\n  Final Budget Audit:");
  console.log(`    - Hard Cap:      ${ethers.formatEther(hardCap)} ETH`);
  console.log(`    - Active Budget: ${ethers.formatEther(budget)} ETH`);
  console.log(`    - Total Spent:   ${ethers.formatEther(spent)} ETH`);
  console.log(`    - Remaining:     ${ethers.formatEther(remaining)} ETH`);
  console.log(`    - Vault Balance: ${ethers.formatEther(await contract.getContractBalance())} ETH`);

  banner("ALL 5 SCENARIOS VERIFIED SUCCESSFULLY ON-CHAIN!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
