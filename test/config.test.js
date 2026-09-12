/**
 * Unit tests for Production Configuration Loader (src/config.js)
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const path = require("path");
const fs = require("fs");
const {
  getContractConfig,
  loadAbi,
  LOCAL_HARDHAT_ADDRESS,
  SEPOLIA_CHAIN_ID,
} = require("../src/config");

describe("Production Configuration Loader (src/config.js)", function () {
  const originalEnv = { ...process.env };
  const validSepoliaAddr = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

  beforeEach(function () {
    process.env = { ...originalEnv };
    delete process.env.CONTRACT_ADDRESS;
    delete process.env.NODE_ENV;
    delete process.env.CHAIN_ID;
  });

  afterEach(function () {
    process.env = { ...originalEnv };
  });

  it("prioritizes CONTRACT_ADDRESS from environment variable", function () {
    process.env.CONTRACT_ADDRESS = validSepoliaAddr;
    const config = getContractConfig();
    expect(config.contractAddress).to.equal(ethers.getAddress(validSepoliaAddr));
    expect(config.source).to.include("ENV");
  });

  it("falls back to deployment.json when CONTRACT_ADDRESS is not set and not in production", function () {
    process.env.NODE_ENV = "development";
    const config = getContractConfig();
    expect(ethers.isAddress(config.contractAddress)).to.be.true;
    expect(config.source).to.include("FALLBACK");
  });

  it("throws in production when CONTRACT_ADDRESS is missing", function () {
    process.env.NODE_ENV = "production";
    delete process.env.CONTRACT_ADDRESS;
    expect(() => getContractConfig()).to.throw(
      "CONTRACT_ADDRESS is required for production deployment."
    );
  });

  it("throws in production if local Hardhat address (0x5FbDB...) is provided", function () {
    process.env.NODE_ENV = "production";
    process.env.CONTRACT_ADDRESS = LOCAL_HARDHAT_ADDRESS;
    expect(() => getContractConfig()).to.throw(
      "Local Hardhat address (0x5FbDB...) cannot be used in production."
    );
  });

  it("throws if contract address is an invalid EVM address", function () {
    process.env.CONTRACT_ADDRESS = "0xinvalidaddress123";
    expect(() => getContractConfig()).to.throw("is not a valid non-zero EVM address.");
  });

  it("throws if contract address is the zero address", function () {
    process.env.CONTRACT_ADDRESS = ethers.ZeroAddress;
    expect(() => getContractConfig()).to.throw("is not a valid non-zero EVM address.");
  });

  it("loadAbi() loads canonical ABI from artifacts-export/AgentPay.json", function () {
    const abi = loadAbi();
    expect(Array.isArray(abi)).to.be.true;
    const fnNames = abi.filter((e) => e.type === "function").map((f) => f.name);
    expect(fnNames).to.include("authorizePayment");
    expect(fnNames).to.include("recordDelivery");
    expect(fnNames).to.include("setBudget");
    expect(fnNames).to.include("getBudgetStatus");
    expect(fnNames).to.include("isProcessed");
  });
});
