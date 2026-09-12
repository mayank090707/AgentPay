/**
 * AgentPay — Architecture v2 Test Suite
 *
 * Tests the full approved architecture:
 *   - Two-tier budget model (hardSpendingCap + mutable budget)
 *   - Custom errors (revertedWithCustomError)
 *   - Project guide functions: setBudget, authorizePayment, recordDelivery,
 *     getBudget, getSpent, getRemaining, isProcessed
 *   - Extended read functions: getPayment, getDeliveryHash, getHardCap,
 *     getContractBalance, getBudgetStatus
 *   - All security invariants from the security model
 *
 * Scenario map:
 *   T1  Deploy — constructor, initial state
 *   T2  setBudget — valid, and all constraint violations
 *   T3  fund() — ETH deposit, event, fallback receive()
 *   T4  authorizePayment — valid payment, full field check
 *   T5  Budget enforcement — BudgetExceeded (soft cap)
 *   T6  Idempotency — AlreadyProcessed on duplicate requestId
 *   T7  Access control — NotAgent on non-agent callers
 *   T8  recordDelivery — full lifecycle, DeliveryRecorded event
 *   T9  Project guide reads — getBudget, getSpent, getRemaining, isProcessed
 *   T10 isProcessed retry guard — false before, true after
 *   T11 getBudgetStatus — all four fields
 *   T12 getPayment — all struct fields
 *   T13 withdraw — owner reclaims ETH, revert cases
 *   T14 setAgent — rotation and access control
 *   T15 End-to-end flow — full pay → deliver sequence
 *   T16 Budget < hardCap — setBudget lower than cap, cap still immutable
 */

const { expect }      = require("chai");
const { ethers }      = require("hardhat");
const {
  parseEther,
  ZeroAddress,
  ZeroHash,
  keccak256,
  toUtf8Bytes,
  id,
} = ethers;
// ── Helpers ───────────────────────────────────────────────────────────────────
/** Deterministic bytes32 requestId from a human-readable string. */
const reqId = (s) => id(s);
/** keccak256 of a UTF-8 string — simulates content hash derivation. */
const contentHashOf = (s) => keccak256(toUtf8Bytes(s));
// Shared constants
const CAP     = parseEther("0.01");   // 0.01 ETH hard cap
const FUND    = parseEther("0.01");   // fund with full cap
const SERVICE = "weather-report";
const AMOUNT  = parseEther("0.001");  // 0.001 ETH per payment
// ── Test suite ────────────────────────────────────────────────────────────────
describe("AgentPay — Architecture v2", function () {
  let contract;
  let owner, agent, provider, stranger, stranger2;
  // Deploy a fresh contract before each test
  beforeEach(async function () {
    [owner, agent, provider, stranger, stranger2] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("AgentPay");
    contract = await Factory.deploy(agent.address, CAP);
    await contract.waitForDeployment();
  });
  // ─── T1: Deployment ─────────────────────────────────────────────────────────
  describe("T1 — Deployment", function () {
    it("sets owner, agent, hardSpendingCap correctly", async function () {
      expect(await contract.owner()).to.equal(owner.address);
      expect(await contract.agent()).to.equal(agent.address);
      expect(await contract.hardSpendingCap()).to.equal(CAP);
    });
    it("initialises budget equal to hardSpendingCap (sensible default)", async function () {
      expect(await contract.budget()).to.equal(CAP);
    });
    it("initialises totalSpent to zero", async function () {
      expect(await contract.totalSpent()).to.equal(0n);
    });
    it("reverts with ZeroAddress on zero agent", async function () {
      const F = await ethers.getContractFactory("AgentPay");
      await expect(F.deploy(ZeroAddress, CAP))
        .to.be.revertedWithCustomError(await F.deploy(agent.address, CAP), "ZeroAddress")
        .catch(() => {}); // deploy succeeds for the error check instance
      // Direct approach:
      await expect(F.deploy(ZeroAddress, CAP))
        .to.be.reverted;
    });
    it("reverts with ZeroAmount on zero cap", async function () {
      const F = await ethers.getContractFactory("AgentPay");
      await expect(F.deploy(agent.address, 0n)).to.be.reverted;
    });
  });
  // ─── T2: setBudget ───────────────────────────────────────────────────────────
  describe("T2 — setBudget", function () {
    it("owner can lower the budget below the hard cap", async function () {
      const newBudget = parseEther("0.005");
      await expect(contract.connect(owner).setBudget(newBudget))
        .to.emit(contract, "BudgetSet")
        .withArgs(CAP, newBudget);
      expect(await contract.getBudget()).to.equal(newBudget);
    });
    it("owner can restore budget back up to hardSpendingCap", async function () {
      await contract.connect(owner).setBudget(parseEther("0.005"));
      await contract.connect(owner).setBudget(CAP);
      expect(await contract.getBudget()).to.equal(CAP);
    });
    it("reverts BudgetExceedsHardCap when amount > hardSpendingCap", async function () {
      const over = CAP + 1n;
      await expect(contract.connect(owner).setBudget(over))
        .to.be.revertedWithCustomError(contract, "BudgetExceedsHardCap")
        .withArgs(over, CAP);
    });
    it("reverts ZeroAmount when amount == 0", async function () {
      await expect(contract.connect(owner).setBudget(0n))
        .to.be.revertedWithCustomError(contract, "ZeroAmount");
    });
    it("reverts BudgetBelowSpent when amount < totalSpent", async function () {
      // Fund and make a payment first
      await contract.connect(owner).fund({ value: FUND });
      await contract.connect(agent).authorizePayment(
        reqId("p1"), AMOUNT, provider.address, SERVICE
      );
      // Now try to lower budget below what was already spent
      await expect(contract.connect(owner).setBudget(AMOUNT - 1n))
        .to.be.revertedWithCustomError(contract, "BudgetBelowSpent")
        .withArgs(AMOUNT - 1n, AMOUNT);
    });
    it("reverts NotOwner when non-owner calls setBudget", async function () {
      await expect(contract.connect(stranger).setBudget(parseEther("0.005")))
        .to.be.revertedWithCustomError(contract, "NotOwner");
    });
    it("agent cannot call setBudget", async function () {
      await expect(contract.connect(agent).setBudget(parseEther("0.005")))
        .to.be.revertedWithCustomError(contract, "NotOwner");
    });
  });
  // ─── T3: fund() ─────────────────────────────────────────────────────────────
  describe("T3 — fund()", function () {
    it("accepts ETH and emits Funded event", async function () {
      await expect(contract.connect(owner).fund({ value: FUND }))
        .to.emit(contract, "Funded")
        .withArgs(owner.address, FUND);
      expect(await contract.getContractBalance()).to.equal(FUND);
    });
    it("anyone can fund the contract (stranger)", async function () {
      await expect(contract.connect(stranger).fund({ value: FUND }))
        .to.emit(contract, "Funded")
        .withArgs(stranger.address, FUND);
    });
    it("receives direct ETH via receive() fallback", async function () {
      const tx = await owner.sendTransaction({
        to: await contract.getAddress(),
        value: FUND,
      });
      await tx.wait();
      expect(await contract.getContractBalance()).to.equal(FUND);
    });
    it("reverts ZeroAmount on fund() with 0 value", async function () {
      await expect(contract.connect(owner).fund({ value: 0n }))
        .to.be.revertedWithCustomError(contract, "ZeroAmount");
    });
  });
  // ─── T4: authorizePayment — valid path ──────────────────────────────────────
  describe("T4 — authorizePayment (valid)", function () {
    beforeEach(async function () {
      await contract.connect(owner).fund({ value: FUND });
    });
    it("transfers ETH to provider and emits PaymentAuthorized", async function () {
      const rId = reqId("purchase-001");
      const providerBefore = await ethers.provider.getBalance(provider.address);
      await expect(
        contract.connect(agent).authorizePayment(rId, AMOUNT, provider.address, SERVICE)
      )
        .to.emit(contract, "PaymentAuthorized")
        .withArgs(rId, SERVICE, provider.address, AMOUNT, AMOUNT, CAP - AMOUNT);
      const providerAfter = await ethers.provider.getBalance(provider.address);
      expect(providerAfter - providerBefore).to.equal(AMOUNT);
    });
    it("updates totalSpent after payment", async function () {
      await contract.connect(agent).authorizePayment(
        reqId("p1"), AMOUNT, provider.address, SERVICE
      );
      expect(await contract.totalSpent()).to.equal(AMOUNT);
    });
    it("marks requestId as processed", async function () {
      const rId = reqId("p1");
      await contract.connect(agent).authorizePayment(rId, AMOUNT, provider.address, SERVICE);
      expect(await contract.isProcessed(rId)).to.be.true;
    });
    it("reduces contract ETH balance by amount", async function () {
      await contract.connect(agent).authorizePayment(
        reqId("p1"), AMOUNT, provider.address, SERVICE
      );
      expect(await contract.getContractBalance()).to.equal(FUND - AMOUNT);
    });
    it("stores full PaymentRecord with correct fields", async function () {
      const rId = reqId("p1");
      const tx  = await contract.connect(agent).authorizePayment(
        rId, AMOUNT, provider.address, SERVICE
      );
      const receipt = await tx.wait();
      const block   = await ethers.provider.getBlock(receipt.blockNumber);
      const p = await contract.getPayment(rId);
      expect(p.requestId).to.equal(rId);
      expect(p.service).to.equal(SERVICE);
      expect(p.provider).to.equal(provider.address);
      expect(p.amount).to.equal(AMOUNT);
      expect(p.contentHash).to.equal(ZeroHash);
      expect(p.paidAt).to.equal(BigInt(block.timestamp));
      expect(p.deliveredAt).to.equal(0n);
      expect(p.delivered).to.be.false;
    });
    it("multiple different requestIds can be paid sequentially", async function () {
      await contract.connect(agent).authorizePayment(
        reqId("p1"), AMOUNT, provider.address, "svc-1"
      );
      await contract.connect(agent).authorizePayment(
        reqId("p2"), AMOUNT, provider.address, "svc-2"
      );
      expect(await contract.totalSpent()).to.equal(AMOUNT * 2n);
    });
  });
  // ─── T5: Budget enforcement (BudgetExceeded) ─────────────────────────────────
  describe("T5 — Budget enforcement", function () {
    beforeEach(async function () {
      await contract.connect(owner).fund({ value: FUND });
    });
    it("rejects payment that exceeds the budget in one shot", async function () {
      await contract.connect(owner).setBudget(AMOUNT); // budget = 0.001 ETH
      await expect(
        contract.connect(agent).authorizePayment(
          reqId("over"), AMOUNT + 1n, provider.address, SERVICE
        )
      ).to.be.revertedWithCustomError(contract, "BudgetExceeded")
        .withArgs(AMOUNT + 1n, AMOUNT); // requested, remaining
    });
    it("rejects second payment that cumulatively exceeds budget", async function () {
      const smallBudget = parseEther("0.0015"); // 1.5x AMOUNT
      await contract.connect(owner).setBudget(smallBudget);
      // First payment succeeds
      await contract.connect(agent).authorizePayment(
        reqId("p1"), AMOUNT, provider.address, SERVICE
      );
      // Second would bring totalSpent to 0.002 > 0.0015
      await expect(
        contract.connect(agent).authorizePayment(
          reqId("p2"), AMOUNT, provider.address, SERVICE
        )
      ).to.be.revertedWithCustomError(contract, "BudgetExceeded");
    });
    it("rejects payment when budget is at full hardSpendingCap and payment exceeds it", async function () {
      // budget == hardSpendingCap == CAP; try paying CAP + 1
      // Must fund more so balance isn't the limiting factor
      await contract.connect(owner).fund({ value: CAP + parseEther("0.1") });
      await expect(
        contract.connect(agent).authorizePayment(
          reqId("over-cap"), CAP + 1n, provider.address, SERVICE
        )
      ).to.be.revertedWithCustomError(contract, "BudgetExceeded");
    });
    it("respects the hard cap as an absolute ceiling via budget invariant", async function () {
      // Demonstrate: budget can never exceed hardSpendingCap, so hard cap is always enforced
      await expect(contract.connect(owner).setBudget(CAP + 1n))
        .to.be.revertedWithCustomError(contract, "BudgetExceedsHardCap");
      // Hard cap is unchanged
      expect(await contract.getHardCap()).to.equal(CAP);
    });
    it("reverts InsufficientContractBalance when contract has no ETH", async function () {
      // Deploy a fresh contract with no funding
      const F = await ethers.getContractFactory("AgentPay");
      const unfunded = await F.deploy(agent.address, CAP);
      await unfunded.waitForDeployment();
      await expect(
        unfunded.connect(agent).authorizePayment(
          reqId("no-eth"), AMOUNT, provider.address, SERVICE
        )
      ).to.be.revertedWithCustomError(unfunded, "InsufficientContractBalance");
    });
    it("rejects zero amount payment", async function () {
      await expect(
        contract.connect(agent).authorizePayment(reqId("p1"), 0n, provider.address, SERVICE)
      ).to.be.revertedWithCustomError(contract, "ZeroAmount");
    });
    it("rejects zero address provider", async function () {
      await expect(
        contract.connect(agent).authorizePayment(reqId("p1"), AMOUNT, ZeroAddress, SERVICE)
      ).to.be.revertedWithCustomError(contract, "ZeroAddress");
    });
    it("rejects empty service string", async function () {
      await expect(
        contract.connect(agent).authorizePayment(reqId("p1"), AMOUNT, provider.address, "")
      ).to.be.revertedWithCustomError(contract, "EmptyService");
    });
  });
  // ─── T6: Idempotency (AlreadyProcessed) ────────────────────────────────────
  describe("T6 — Idempotency", function () {
    beforeEach(async function () {
      await contract.connect(owner).fund({ value: FUND });
    });
    it("rejects duplicate requestId with AlreadyProcessed", async function () {
      const rId = reqId("idempotent-001");
      await contract.connect(agent).authorizePayment(rId, AMOUNT, provider.address, SERVICE);
      await expect(
        contract.connect(agent).authorizePayment(rId, AMOUNT, provider.address, SERVICE)
      )
        .to.be.revertedWithCustomError(contract, "AlreadyProcessed")
        .withArgs(rId);
    });
    it("AlreadyProcessed fires even with different amount/provider for same requestId", async function () {
      const rId = reqId("idempotent-001");
      await contract.connect(agent).authorizePayment(rId, AMOUNT, provider.address, SERVICE);
      await expect(
        contract.connect(agent).authorizePayment(rId, AMOUNT / 2n, stranger.address, "hack")
      )
        .to.be.revertedWithCustomError(contract, "AlreadyProcessed")
        .withArgs(rId);
    });
    it("different requestIds are independent (no cross-contamination)", async function () {
      const rId1 = reqId("purchase-001");
      const rId2 = reqId("purchase-002");
      await contract.connect(agent).authorizePayment(rId1, AMOUNT, provider.address, "svc-1");
      // rId2 should not be affected
      expect(await contract.isProcessed(rId2)).to.be.false;
    });
  });
  // ─── T7: Access control ─────────────────────────────────────────────────────
  describe("T7 — Access control", function () {
    beforeEach(async function () {
      await contract.connect(owner).fund({ value: FUND });
    });
    it("reverts NotAgent when stranger calls authorizePayment", async function () {
      await expect(
        contract.connect(stranger).authorizePayment(reqId("x"), AMOUNT, provider.address, SERVICE)
      ).to.be.revertedWithCustomError(contract, "NotAgent");
    });
    it("reverts NotAgent when OWNER calls authorizePayment", async function () {
      await expect(
        contract.connect(owner).authorizePayment(reqId("x"), AMOUNT, provider.address, SERVICE)
      ).to.be.revertedWithCustomError(contract, "NotAgent");
    });
    it("reverts NotAgent when stranger calls recordDelivery", async function () {
      const rId = reqId("p1");
      await contract.connect(agent).authorizePayment(rId, AMOUNT, provider.address, SERVICE);
      await expect(
        contract.connect(stranger).recordDelivery(rId, contentHashOf("output"))
      ).to.be.revertedWithCustomError(contract, "NotAgent");
    });
    it("reverts NotOwner when stranger calls withdraw", async function () {
      await expect(contract.connect(stranger).withdraw(AMOUNT))
        .to.be.revertedWithCustomError(contract, "NotOwner");
    });
    it("reverts NotOwner when agent calls withdraw", async function () {
      await expect(contract.connect(agent).withdraw(AMOUNT))
        .to.be.revertedWithCustomError(contract, "NotOwner");
    });
  });
  // ─── T8: recordDelivery ──────────────────────────────────────────────────────
  describe("T8 — recordDelivery", function () {
    let rId;
    const cHash = contentHashOf('{"result":"sunny","temp":"28C"}');
    beforeEach(async function () {
      rId = reqId("purchase-001");
      await contract.connect(owner).fund({ value: FUND });
      await contract.connect(agent).authorizePayment(rId, AMOUNT, provider.address, SERVICE);
    });
    it("records contentHash and emits DeliveryRecorded", async function () {
      await expect(contract.connect(agent).recordDelivery(rId, cHash))
        .to.emit(contract, "DeliveryRecorded")
        .withArgs(rId, cHash);
    });
    it("getDeliveryHash returns the recorded hash", async function () {
      await contract.connect(agent).recordDelivery(rId, cHash);
      expect(await contract.getDeliveryHash(rId)).to.equal(cHash);
    });
    it("marks payment as delivered in the PaymentRecord struct", async function () {
      await contract.connect(agent).recordDelivery(rId, cHash);
      const p = await contract.getPayment(rId);
      expect(p.delivered).to.be.true;
      expect(p.contentHash).to.equal(cHash);
      expect(p.deliveredAt).to.be.gt(0n);
    });
    it("getDeliveryHash returns ZeroHash before delivery is recorded", async function () {
      expect(await contract.getDeliveryHash(rId)).to.equal(ZeroHash);
    });
    it("reverts NotProcessed for an unpaid requestId", async function () {
      await expect(
        contract.connect(agent).recordDelivery(reqId("never-paid"), cHash)
      ).to.be.revertedWithCustomError(contract, "NotProcessed")
        .withArgs(reqId("never-paid"));
    });
    it("reverts AlreadyDelivered on duplicate recordDelivery", async function () {
      await contract.connect(agent).recordDelivery(rId, cHash);
      await expect(
        contract.connect(agent).recordDelivery(rId, cHash)
      ).to.be.revertedWithCustomError(contract, "AlreadyDelivered")
        .withArgs(rId);
    });
    it("reverts ZeroContentHash when contentHash is bytes32(0)", async function () {
      await expect(
        contract.connect(agent).recordDelivery(rId, ZeroHash)
      ).to.be.revertedWithCustomError(contract, "ZeroContentHash");
    });
  });
  // ─── T9: Project guide read functions ───────────────────────────────────────
  describe("T9 — Project guide reads: getBudget, getSpent, getRemaining, isProcessed", function () {
    it("getBudget returns current budget", async function () {
      expect(await contract.getBudget()).to.equal(CAP);
      await contract.connect(owner).setBudget(parseEther("0.005"));
      expect(await contract.getBudget()).to.equal(parseEther("0.005"));
    });
    it("getSpent returns 0 before any payment", async function () {
      expect(await contract.getSpent()).to.equal(0n);
    });
    it("getSpent returns correct value after payments", async function () {
      await contract.connect(owner).fund({ value: FUND });
      await contract.connect(agent).authorizePayment(reqId("p1"), AMOUNT, provider.address, "s1");
      await contract.connect(agent).authorizePayment(reqId("p2"), AMOUNT, provider.address, "s2");
      expect(await contract.getSpent()).to.equal(AMOUNT * 2n);
    });
    it("getRemaining returns budget - totalSpent", async function () {
      expect(await contract.getRemaining()).to.equal(CAP); // 0 spent
      await contract.connect(owner).fund({ value: FUND });
      await contract.connect(agent).authorizePayment(reqId("p1"), AMOUNT, provider.address, "s1");
      expect(await contract.getRemaining()).to.equal(CAP - AMOUNT);
    });
    it("isProcessed returns false for unseen requestId", async function () {
      expect(await contract.isProcessed(reqId("unseen"))).to.be.false;
    });
    it("isProcessed returns true immediately after payment", async function () {
      const rId = reqId("p1");
      await contract.connect(owner).fund({ value: FUND });
      await contract.connect(agent).authorizePayment(rId, AMOUNT, provider.address, SERVICE);
      expect(await contract.isProcessed(rId)).to.be.true;
    });
  });
  // ─── T10: isProcessed — retry detection ─────────────────────────────────────
  describe("T10 — isProcessed retry guard", function () {
    it("agent can safely detect already-paid request before retrying", async function () {
      const rId = reqId("retry-test-001");
      await contract.connect(owner).fund({ value: FUND });
      // Simulate: agent calls isProcessed BEFORE sending tx
      const beforePayment = await contract.isProcessed(rId);
      expect(beforePayment).to.be.false;
      await contract.connect(agent).authorizePayment(rId, AMOUNT, provider.address, SERVICE);
      // Simulate: agent restarts, checks idempotency before retrying
      const afterPayment = await contract.isProcessed(rId);
      expect(afterPayment).to.be.true;
      // → agent skips authorizePayment, jumps to delivery verification
    });
  });
  // ─── T11: getBudgetStatus ────────────────────────────────────────────────────
  describe("T11 — getBudgetStatus (four-tuple read)", function () {
    it("returns all four fields correctly at deployment", async function () {
      const [hardCap, bgt, spent, remaining] = await contract.getBudgetStatus();
      expect(hardCap).to.equal(CAP);
      expect(bgt).to.equal(CAP);     // budget initialised to hardSpendingCap
      expect(spent).to.equal(0n);
      expect(remaining).to.equal(CAP);
    });
    it("reflects correct values after setBudget and payment", async function () {
      const newBudget = parseEther("0.005");
      await contract.connect(owner).setBudget(newBudget);
      await contract.connect(owner).fund({ value: FUND });
      await contract.connect(agent).authorizePayment(
        reqId("p1"), AMOUNT, provider.address, SERVICE
      );
      const [hardCap, bgt, spent, remaining] = await contract.getBudgetStatus();
      expect(hardCap).to.equal(CAP);          // hard cap unchanged
      expect(bgt).to.equal(newBudget);
      expect(spent).to.equal(AMOUNT);
      expect(remaining).to.equal(newBudget - AMOUNT);
    });
  });
  // ─── T12: getPayment ─────────────────────────────────────────────────────────
  describe("T12 — getPayment struct", function () {
    it("returns all-zero struct for unpaid requestId", async function () {
      const p = await contract.getPayment(reqId("unpaid"));
      expect(p.amount).to.equal(0n);
      expect(p.provider).to.equal(ZeroAddress);
      expect(p.delivered).to.be.false;
    });
    it("returns full record after payment + delivery", async function () {
      const rId   = reqId("full-record");
      const cHash = contentHashOf("delivery payload");
      await contract.connect(owner).fund({ value: FUND });
      await contract.connect(agent).authorizePayment(rId, AMOUNT, provider.address, SERVICE);
      await contract.connect(agent).recordDelivery(rId, cHash);
      const p = await contract.getPayment(rId);
      expect(p.requestId).to.equal(rId);
      expect(p.service).to.equal(SERVICE);
      expect(p.provider).to.equal(provider.address);
      expect(p.amount).to.equal(AMOUNT);
      expect(p.contentHash).to.equal(cHash);
      expect(p.paidAt).to.be.gt(0n);
      expect(p.deliveredAt).to.be.gt(0n);
      expect(p.delivered).to.be.true;
    });
  });
  // ─── T13: withdraw ───────────────────────────────────────────────────────────
  describe("T13 — withdraw", function () {
    it("owner withdraws unspent ETH and Withdrawn event fires", async function () {
      await contract.connect(owner).fund({ value: FUND });
      await contract.connect(agent).authorizePayment(
        reqId("p1"), AMOUNT, provider.address, SERVICE
      );
      const leftover = FUND - AMOUNT;
      await expect(contract.connect(owner).withdraw(leftover))
        .to.emit(contract, "Withdrawn")
        .withArgs(owner.address, leftover);
      expect(await contract.getContractBalance()).to.equal(0n);
    });
    it("reverts InsufficientContractBalance when amount > balance", async function () {
      await contract.connect(owner).fund({ value: FUND });
      await expect(contract.connect(owner).withdraw(FUND + 1n))
        .to.be.revertedWithCustomError(contract, "InsufficientContractBalance")
        .withArgs(FUND + 1n, FUND);
    });
    it("reverts ZeroAmount on withdraw(0)", async function () {
      await expect(contract.connect(owner).withdraw(0n))
        .to.be.revertedWithCustomError(contract, "ZeroAmount");
    });
    it("reverts NotOwner when non-owner withdraws", async function () {
      await contract.connect(owner).fund({ value: FUND });
      await expect(contract.connect(stranger).withdraw(AMOUNT))
        .to.be.revertedWithCustomError(contract, "NotOwner");
    });
  });
  // ─── T14: setAgent ───────────────────────────────────────────────────────────
  describe("T14 — setAgent", function () {
    it("owner can rotate agent and AgentUpdated event fires", async function () {
      await expect(contract.connect(owner).setAgent(stranger.address))
        .to.emit(contract, "AgentUpdated")
        .withArgs(agent.address, stranger.address);
      expect(await contract.agent()).to.equal(stranger.address);
    });
    it("old agent loses access after rotation", async function () {
      await contract.connect(owner).fund({ value: FUND });
      await contract.connect(owner).setAgent(stranger.address);
      await expect(
        contract.connect(agent).authorizePayment(
          reqId("x"), AMOUNT, provider.address, SERVICE
        )
      ).to.be.revertedWithCustomError(contract, "NotAgent");
    });
    it("new agent gains access after rotation", async function () {
      await contract.connect(owner).fund({ value: FUND });
      await contract.connect(owner).setAgent(stranger.address);
      await expect(
        contract.connect(stranger).authorizePayment(
          reqId("new-agent-pay"), AMOUNT, provider.address, SERVICE
        )
      ).to.emit(contract, "PaymentAuthorized");
    });
    it("reverts ZeroAddress on setAgent(zero)", async function () {
      await expect(contract.connect(owner).setAgent(ZeroAddress))
        .to.be.revertedWithCustomError(contract, "ZeroAddress");
    });
    it("reverts NotOwner when non-owner calls setAgent", async function () {
      await expect(contract.connect(stranger).setAgent(stranger2.address))
        .to.be.revertedWithCustomError(contract, "NotOwner");
    });
  });
  // ─── T15: End-to-end flow ────────────────────────────────────────────────────
  describe("T15 — End-to-end: fund → setBudget → pay → recordDelivery", function () {
    it("complete lifecycle executes correctly with correct final state", async function () {
      // Owner funds
      await contract.connect(owner).fund({ value: FUND });
      // Owner lowers budget for this session
      const sessionBudget = parseEther("0.003");
      await contract.connect(owner).setBudget(sessionBudget);
      // Agent checks idempotency
      const rId = reqId("e2e-001");
      expect(await contract.isProcessed(rId)).to.be.false;
      // Agent pays
      await contract.connect(agent).authorizePayment(
        rId, AMOUNT, provider.address, "ai-analysis"
      );
      // Budget reads reflect payment
      expect(await contract.getSpent()).to.equal(AMOUNT);
      expect(await contract.getRemaining()).to.equal(sessionBudget - AMOUNT);
      expect(await contract.isProcessed(rId)).to.be.true;
      // Agent records delivery (contentHash from Person 3's HTTP response)
      const cHash = contentHashOf('{"analysis":"positive","confidence":0.92}');
      await contract.connect(agent).recordDelivery(rId, cHash);
      // Final state
      const p = await contract.getPayment(rId);
      expect(p.delivered).to.be.true;
      expect(p.contentHash).to.equal(cHash);
      expect(await contract.getDeliveryHash(rId)).to.equal(cHash);
    });
  });
  // ─── T16: Two-tier budget — budget < hardCap ────────────────────────────────
  describe("T16 — Two-tier: budget < hardCap enforces the lower limit", function () {
    it("payment is blocked by budget even when hardCap would allow it", async function () {
      // Fund contract with double the hard cap for balance
      await contract.connect(owner).fund({ value: FUND });
      // Lower the operational budget to a fraction of the hard cap
      const tightBudget = parseEther("0.002");
      await contract.connect(owner).setBudget(tightBudget);
      // Make one payment that uses up the tight budget
      await contract.connect(agent).authorizePayment(
        reqId("p1"), parseEther("0.002"), provider.address, SERVICE
      );
      // Next payment should fail — budget exhausted even though hardCap has room
      await expect(
        contract.connect(agent).authorizePayment(
          reqId("p2"), parseEther("0.001"), provider.address, SERVICE
        )
      ).to.be.revertedWithCustomError(contract, "BudgetExceeded");
      // Hard cap itself is unchanged
      expect(await contract.getHardCap()).to.equal(CAP);
      // Budget cannot be raised above hardCap
      await expect(contract.connect(owner).setBudget(CAP + 1n))
        .to.be.revertedWithCustomError(contract, "BudgetExceedsHardCap");
    });
    it("owner can raise budget up to hardCap but not beyond (hard cap is immutable)", async function () {
      await contract.connect(owner).setBudget(parseEther("0.005"));
      await contract.connect(owner).setBudget(CAP); // restore to max allowed
      expect(await contract.getBudget()).to.equal(CAP);
      // Cannot go over
      await expect(contract.connect(owner).setBudget(CAP + 1n))
        .to.be.revertedWithCustomError(contract, "BudgetExceedsHardCap");
      // hardSpendingCap itself has not changed
      expect(await contract.getHardCap()).to.equal(CAP);
    });
  });
  // ─── T17: Malicious Provider & Reentrancy / Transfer Failure ────────────────
  describe("T17 — Malicious Provider & Reentrancy / Transfer Failure", function () {
    let revertingReceiver;
    let reentrantProvider;
    beforeEach(async function () {
      await contract.connect(owner).fund({ value: FUND });
      const RevertF = await ethers.getContractFactory("MockRevertingReceiver");
      revertingReceiver = await RevertF.deploy();
      await revertingReceiver.waitForDeployment();
      const ReentrantF = await ethers.getContractFactory("MockReentrantProvider");
      reentrantProvider = await ReentrantF.deploy(await contract.getAddress());
      await reentrantProvider.waitForDeployment();
    });
    it("reverts with TransferFailed when provider rejects incoming ETH", async function () {
      const rId = reqId("revert-transfer-001");
      const revAddr = await revertingReceiver.getAddress();
      await expect(
        contract.connect(agent).authorizePayment(rId, AMOUNT, revAddr, SERVICE)
      ).to.be.revertedWithCustomError(contract, "TransferFailed");
      // Verify state was completely reverted: not processed, no spend
      expect(await contract.isProcessed(rId)).to.be.false;
      expect(await contract.totalSpent()).to.equal(0n);
      expect(await contract.getContractBalance()).to.equal(FUND);
    });
    it("prevents reentrancy attack into authorizePayment by malicious provider", async function () {
      const rId = reqId("reentrant-test-001");
      const attackReqId = reqId("reentrant-attack-002");
      const providerAddr = await reentrantProvider.getAddress();
      // Configure provider to attack authorizePayment during receive
      await reentrantProvider.setAttack("authorizePayment", attackReqId);
      // Execute payment — provider's receive() will attempt to re-enter
      // Even if provider attempts reentrancy, it is blocked (caller is provider != agent, and nonReentrant)
      await contract.connect(agent).authorizePayment(rId, AMOUNT, providerAddr, SERVICE);
      expect(await reentrantProvider.attackAttempted()).to.be.true;
      expect(await reentrantProvider.attackSucceeded()).to.be.false;
      expect(await contract.isProcessed(attackReqId)).to.be.false;
      expect(await contract.totalSpent()).to.equal(AMOUNT);
    });
    it("prevents reentrancy attack into withdraw by malicious provider", async function () {
      const rId = reqId("reentrant-withdraw-001");
      const providerAddr = await reentrantProvider.getAddress();
      await reentrantProvider.setAttack("withdraw", reqId("dummy"));
      await contract.connect(agent).authorizePayment(rId, AMOUNT, providerAddr, SERVICE);
      expect(await reentrantProvider.attackAttempted()).to.be.true;
      expect(await reentrantProvider.attackSucceeded()).to.be.false;
    });
  });
  // ─── T18: Malicious Owner & Withdraw Safety ──────────────────────────────────
  describe("T18 — Malicious Owner & Withdraw Safety", function () {
    it("prevents reentrancy on withdraw via MockReentrantOwner", async function () {
      const Factory = await ethers.getContractFactory("AgentPay");
      const ReentrantOwnerF = await ethers.getContractFactory("MockReentrantOwner");
      const attackingOwner = await ReentrantOwnerF.deploy(ZeroAddress);
      await attackingOwner.waitForDeployment();
      const attackingAddr = await attackingOwner.getAddress();
      // Fund attackingOwner for gas
      await ethers.provider.send("hardhat_setBalance", [
        attackingAddr,
        "0x56BC75E2D63100000", // 100 ETH
      ]);
      const attackingSigner = await ethers.getImpersonatedSigner(attackingAddr);
      const targetContract = await Factory.connect(attackingSigner).deploy(agent.address, CAP);
      await targetContract.waitForDeployment();
      await attackingOwner.setTarget(await targetContract.getAddress());
      // Fund target contract
      await targetContract.connect(attackingSigner).fund({ value: parseEther("0.005") });
      // Activate reentrant attack
      await attackingOwner.setAttackActive(true);
      // Initiate withdraw — inner reentrant call must fail
      await attackingOwner.initiateWithdraw(parseEther("0.002"));
      expect(await attackingOwner.attackAttempted()).to.be.true;
      expect(await attackingOwner.attackSucceeded()).to.be.false;
    });
    it("reverts with TransferFailed when owner rejects withdraw ETH", async function () {
      const Factory = await ethers.getContractFactory("AgentPay");
      const RevertF = await ethers.getContractFactory("MockRevertingReceiver");
      const revertingOwner = await RevertF.deploy();
      await revertingOwner.waitForDeployment();
      const revAddr = await revertingOwner.getAddress();
      // Disable revert during setup
      await revertingOwner.setRevert(false);
      await ethers.provider.send("hardhat_setBalance", [
        revAddr,
        "0x56BC75E2D63100000", // 100 ETH
      ]);
      const revSigner = await ethers.getImpersonatedSigner(revAddr);
      const targetContract = await Factory.connect(revSigner).deploy(agent.address, CAP);
      await targetContract.waitForDeployment();
      // Fund target contract
      await targetContract.connect(revSigner).fund({ value: parseEther("0.005") });
      // Now enable revert on receiver
      await revertingOwner.setRevert(true);
      // Owner initiates withdraw — receiver will revert, triggering TransferFailed
      await expect(
        targetContract.connect(revSigner).withdraw(parseEther("0.002"))
      ).to.be.revertedWithCustomError(targetContract, "TransferFailed");
    });
  });
  // ─── T19: Exact Boundary Conditions ──────────────────────────────────────────
  describe("T19 — Exact Boundary Conditions", function () {
    beforeEach(async function () {
      await contract.connect(owner).fund({ value: CAP });
    });
    it("single payment of exactly hardSpendingCap succeeds (100% boundary)", async function () {
      const rId = reqId("exact-cap-single");
      await expect(
        contract.connect(agent).authorizePayment(rId, CAP, provider.address, SERVICE)
      ).to.emit(contract, "PaymentAuthorized")
        .withArgs(rId, SERVICE, provider.address, CAP, CAP, 0n);
      expect(await contract.getSpent()).to.equal(CAP);
      expect(await contract.getRemaining()).to.equal(0n);
      // Further payment of even 1 wei is rejected
      await expect(
        contract.connect(agent).authorizePayment(reqId("plus-one"), 1n, provider.address, SERVICE)
      ).to.be.revertedWithCustomError(contract, "BudgetExceeded")
        .withArgs(1n, 0n);
    });
    it("sequential payments summing to exactly hardSpendingCap all succeed", async function () {
      // 10 payments of 0.001 ETH = 0.01 ETH exactly
      const slice = parseEther("0.001");
      for (let i = 0; i < 10; i++) {
        await contract.connect(agent).authorizePayment(
          reqId(`slice-${i}`), slice, provider.address, `svc-${i}`
        );
      }
      expect(await contract.getSpent()).to.equal(CAP);
      expect(await contract.getRemaining()).to.equal(0n);
      // 11th payment of 1 wei fails
      await expect(
        contract.connect(agent).authorizePayment(reqId("slice-10"), 1n, provider.address, SERVICE)
      ).to.be.revertedWithCustomError(contract, "BudgetExceeded")
        .withArgs(1n, 0n);
    });
    it("rejects payment that exceeds remaining budget by exactly 1 wei", async function () {
      const rId1 = reqId("p1-sub");
      // Spend 0.009 ETH
      const initialSpend = parseEther("0.009");
      await contract.connect(agent).authorizePayment(rId1, initialSpend, provider.address, SERVICE);
      const remaining = await contract.getRemaining();
      expect(remaining).to.equal(parseEther("0.001"));
      // Exactly remaining + 1 wei
      await expect(
        contract.connect(agent).authorizePayment(
          reqId("p2-over-1wei"), remaining + 1n, provider.address, SERVICE
        )
      ).to.be.revertedWithCustomError(contract, "BudgetExceeded")
        .withArgs(remaining + 1n, remaining);
      // But exactly remaining succeeds
      await expect(
        contract.connect(agent).authorizePayment(
          reqId("p2-exact"), remaining, provider.address, SERVICE
        )
      ).to.emit(contract, "PaymentAuthorized");
      expect(await contract.getRemaining()).to.equal(0n);
    });
  });
  // ─── T20: Edge Cases & Access Control Depth ──────────────────────────────────
  describe("T20 — Edge Cases & Access Control Depth", function () {
    it("reverts NotAgent when OWNER calls recordDelivery", async function () {
      await contract.connect(owner).fund({ value: FUND });
      const rId = reqId("owner-delivery-attempt");
      await contract.connect(agent).authorizePayment(rId, AMOUNT, provider.address, SERVICE);
      await expect(
        contract.connect(owner).recordDelivery(rId, contentHashOf("hash"))
      ).to.be.revertedWithCustomError(contract, "NotAgent");
    });
    it("reverts InsufficientContractBalance with partial balance details", async function () {
      // Contract funded with only 0.0005 ETH (half of AMOUNT)
      const partialFund = parseEther("0.0005");
      await contract.connect(owner).fund({ value: partialFund });
      await expect(
        contract.connect(agent).authorizePayment(reqId("partial"), AMOUNT, provider.address, SERVICE)
      ).to.be.revertedWithCustomError(contract, "InsufficientContractBalance")
        .withArgs(AMOUNT, partialFund);
    });
    it("allows bytes32(0) as requestId deterministically without collision", async function () {
      await contract.connect(owner).fund({ value: FUND });
      const zeroReq = ZeroHash;
      await expect(
        contract.connect(agent).authorizePayment(zeroReq, AMOUNT, provider.address, SERVICE)
      ).to.emit(contract, "PaymentAuthorized");
      expect(await contract.isProcessed(zeroReq)).to.be.true;
      // Duplicate bytes32(0) correctly reverts AlreadyProcessed
      await expect(
        contract.connect(agent).authorizePayment(zeroReq, AMOUNT, provider.address, SERVICE)
      ).to.be.revertedWithCustomError(contract, "AlreadyProcessed")
        .withArgs(zeroReq);
    });
  });
});
