const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;

describe("AgentPay — Phase 5 End-to-End Multi-Role Integration Tests (TESTS 1 to 8)", function () {
  let contract;
  let owner, agent, provider, stranger;
  const HARD_CAP = ethers.parseEther("0.1"); // 0.1 ETH
  const INITIAL_BUDGET = ethers.parseEther("0.05"); // 0.05 ETH
  const FUND_AMOUNT = ethers.parseEther("0.2"); // 0.2 ETH

  beforeEach(async function () {
    [owner, agent, provider, stranger] = await ethers.getSigners();

    // Deploy contract
    const AgentPay = await ethers.getContractFactory("AgentPay");
    contract = await AgentPay.deploy(agent.address, HARD_CAP);
    await contract.waitForDeployment();

    // Set initial budget
    await contract.connect(owner).setBudget(INITIAL_BUDGET);

    // Fund contract vault
    await owner.sendTransaction({
      to: await contract.getAddress(),
      value: FUND_AMOUNT,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1 — SUCCESSFUL PURCHASE
  // ─────────────────────────────────────────────────────────────────────────
  it("TEST 1 — SUCCESSFUL PURCHASE: Authorizes payment, transfers ETH, updates accounting, emits PaymentAuthorized", async function () {
    const uuid = "purchase-weather-test-001";
    const requestId = ethers.id(uuid);
    const amount = ethers.parseEther("0.01");
    const service = "weather-report";

    const [,, spentBefore, remainingBefore] = await contract.getBudgetStatus();
    const providerBalanceBefore = await ethers.provider.getBalance(provider.address);

    // Agent authorizes payment
    const tx = await contract.connect(agent).authorizePayment(
      requestId,
      amount,
      provider.address,
      service
    );
    const receipt = await tx.wait();

    // 1. Verify Event emission
    await expect(tx)
      .to.emit(contract, "PaymentAuthorized")
      .withArgs(
        requestId,
        service,
        provider.address,
        amount,
        amount, // totalSpent
        INITIAL_BUDGET - amount // remainingBudget
      );

    // 2. Verify provider received ETH
    const providerBalanceAfter = await ethers.provider.getBalance(provider.address);
    expect(providerBalanceAfter - providerBalanceBefore).to.equal(amount);

    // 3. Verify budget accounting
    const [,, spentAfter, remainingAfter] = await contract.getBudgetStatus();
    expect(spentAfter - spentBefore).to.equal(amount);
    expect(remainingBefore - remainingAfter).to.equal(amount);

    // 4. Verify isProcessed
    expect(await contract.isProcessed(requestId)).to.be.true;

    // 5. Verify full PaymentRecord struct
    const record = await contract.getPayment(requestId);
    expect(record.requestId).to.equal(requestId);
    expect(record.service).to.equal(service);
    expect(record.provider).to.equal(provider.address);
    expect(record.amount).to.equal(amount);
    expect(record.delivered).to.be.false;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2 — OVERSPENDING
  // ─────────────────────────────────────────────────────────────────────────
  it("TEST 2 — OVERSPENDING: Attempting amount greater than remaining budget reverts BudgetExceeded", async function () {
    const uuid = "purchase-excessive-002";
    const requestId = ethers.id(uuid);
    const excessiveAmount = ethers.parseEther("0.06"); // budget is 0.05

    const [,, spentBefore] = await contract.getBudgetStatus();
    const providerBalanceBefore = await ethers.provider.getBalance(provider.address);

    await expect(
      contract.connect(agent).authorizePayment(
        requestId,
        excessiveAmount,
        provider.address,
        "large-compute"
      )
    ).to.be.revertedWithCustomError(contract, "BudgetExceeded")
     .withArgs(excessiveAmount, INITIAL_BUDGET);

    // Verify state unchanged
    const [,, spentAfter] = await contract.getBudgetStatus();
    expect(spentAfter).to.equal(spentBefore);
    expect(await ethers.provider.getBalance(provider.address)).to.equal(providerBalanceBefore);
    expect(await contract.isProcessed(requestId)).to.be.false;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3 — DUPLICATE REQUEST
  // ─────────────────────────────────────────────────────────────────────────
  it("TEST 3 — DUPLICATE REQUEST: Resubmitting the same requestId reverts with AlreadyProcessed (idempotency)", async function () {
    const uuid = "purchase-idempotency-003";
    const requestId = ethers.id(uuid);
    const amount = ethers.parseEther("0.005");

    // First attempt succeeds
    await contract.connect(agent).authorizePayment(
      requestId,
      amount,
      provider.address,
      "translation"
    );
    expect(await contract.isProcessed(requestId)).to.be.true;

    const providerBalanceMid = await ethers.provider.getBalance(provider.address);
    const [,, spentMid] = await contract.getBudgetStatus();

    // Second attempt with SAME requestId
    await expect(
      contract.connect(agent).authorizePayment(
        requestId,
        amount,
        provider.address,
        "translation"
      )
    ).to.be.revertedWithCustomError(contract, "AlreadyProcessed")
     .withArgs(requestId);

    // Confirm no double charging
    expect(await ethers.provider.getBalance(provider.address)).to.equal(providerBalanceMid);
    const [,, spentAfter] = await contract.getBudgetStatus();
    expect(spentAfter).to.equal(spentMid);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4 — DELIVERY PROOF
  // ─────────────────────────────────────────────────────────────────────────
  it("TEST 4 — DELIVERY PROOF: recordDelivery binds contentHash and emits DeliveryRecorded", async function () {
    const uuid = "purchase-delivery-004";
    const requestId = ethers.id(uuid);
    const amount = ethers.parseEther("0.002");

    await contract.connect(agent).authorizePayment(
      requestId,
      amount,
      provider.address,
      "storage"
    );

    // Compute canonical content hash
    const servicePayload = JSON.stringify({ key: "k1", status: "stored", size: 1024 });
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes(servicePayload));

    // Agent records delivery
    const tx = await contract.connect(agent).recordDelivery(requestId, contentHash);

    await expect(tx)
      .to.emit(contract, "DeliveryRecorded")
      .withArgs(requestId, contentHash);

    // Verify on-chain delivery state
    expect(await contract.getDeliveryHash(requestId)).to.equal(contentHash);
    const record = await contract.getPayment(requestId);
    expect(record.delivered).to.be.true;
    expect(record.contentHash).to.equal(contentHash);
    expect(record.deliveredAt).to.be.gt(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 5 — DUPLICATE DELIVERY
  // ─────────────────────────────────────────────────────────────────────────
  it("TEST 5 — DUPLICATE DELIVERY: Calling recordDelivery again reverts AlreadyDelivered", async function () {
    const uuid = "purchase-duplicate-delivery-005";
    const requestId = ethers.id(uuid);
    const amount = ethers.parseEther("0.002");
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes("output-5"));

    await contract.connect(agent).authorizePayment(
      requestId,
      amount,
      provider.address,
      "compute"
    );

    // First delivery record succeeds
    await contract.connect(agent).recordDelivery(requestId, contentHash);

    // Second delivery record must revert
    await expect(
      contract.connect(agent).recordDelivery(requestId, contentHash)
    ).to.be.revertedWithCustomError(contract, "AlreadyDelivered")
     .withArgs(requestId);

    // Content hash remains intact
    expect(await contract.getDeliveryHash(requestId)).to.equal(contentHash);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 6 — UNAUTHORIZED AGENT ACTION
  // ─────────────────────────────────────────────────────────────────────────
  it("TEST 6 — UNAUTHORIZED AGENT ACTION: Owner or stranger calling authorizePayment reverts NotAgent", async function () {
    const requestId = ethers.id("unauthorized-req-006");
    const amount = ethers.parseEther("0.001");

    // Owner attempt
    await expect(
      contract.connect(owner).authorizePayment(
        requestId,
        amount,
        provider.address,
        "service"
      )
    ).to.be.revertedWithCustomError(contract, "NotAgent");

    // Stranger attempt
    await expect(
      contract.connect(stranger).authorizePayment(
        requestId,
        amount,
        provider.address,
        "service"
      )
    ).to.be.revertedWithCustomError(contract, "NotAgent");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 7 — UNAUTHORIZED DELIVERY
  // ─────────────────────────────────────────────────────────────────────────
  it("TEST 7 — UNAUTHORIZED DELIVERY: Owner or stranger calling recordDelivery reverts NotAgent", async function () {
    const requestId = ethers.id("delivery-req-007");
    const amount = ethers.parseEther("0.001");
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes("output-7"));

    await contract.connect(agent).authorizePayment(
      requestId,
      amount,
      provider.address,
      "service"
    );

    // Owner attempt
    await expect(
      contract.connect(owner).recordDelivery(requestId, contentHash)
    ).to.be.revertedWithCustomError(contract, "NotAgent");

    // Stranger attempt
    await expect(
      contract.connect(stranger).recordDelivery(requestId, contentHash)
    ).to.be.revertedWithCustomError(contract, "NotAgent");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 8 — FRONTEND VISIBILITY
  // ─────────────────────────────────────────────────────────────────────────
  it("TEST 8 — FRONTEND VISIBILITY: Public getters accurately reflect live payment, delivery, and budget status", async function () {
    const uuid = "visibility-test-008";
    const requestId = ethers.id(uuid);
    const amount = ethers.parseEther("0.004");
    const service = "translation-matrix";
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes("matrix-output"));

    // Execute full lifecycle
    await contract.connect(agent).authorizePayment(
      requestId,
      amount,
      provider.address,
      service
    );
    await contract.connect(agent).recordDelivery(requestId, contentHash);

    // 1. Single 4-tuple read used by Frontend StatCard & Context
    const [hardCap, currentBudget, totalSpent, remainingBudget] = await contract.getBudgetStatus();
    expect(hardCap).to.equal(HARD_CAP);
    expect(currentBudget).to.equal(INITIAL_BUDGET);
    expect(totalSpent).to.equal(amount);
    expect(remainingBudget).to.equal(INITIAL_BUDGET - amount);

    // 2. Individual getters
    expect(await contract.getBudget()).to.equal(INITIAL_BUDGET);
    expect(await contract.getSpent()).to.equal(amount);
    expect(await contract.getRemaining()).to.equal(INITIAL_BUDGET - amount);
    expect(await contract.getHardCap()).to.equal(HARD_CAP);
    expect(await contract.isProcessed(requestId)).to.be.true;

    // 3. Detailed payment inspection
    const payment = await contract.getPayment(requestId);
    expect(payment.requestId).to.equal(requestId);
    expect(payment.service).to.equal(service);
    expect(payment.provider).to.equal(provider.address);
    expect(payment.amount).to.equal(amount);
    expect(payment.contentHash).to.equal(contentHash);
    expect(payment.delivered).to.be.true;
    expect(payment.paidAt).to.be.gt(0);
    expect(payment.deliveredAt).to.be.gte(payment.paidAt);
  });
});
