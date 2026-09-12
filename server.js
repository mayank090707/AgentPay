/**
 * AgentPay — Production Blockchain Status & ABI Service (Render Ready)
 *
 * Lightweight HTTP service suitable for Render web service deployment.
 * Binds to 0.0.0.0 and process.env.PORT.
 *
 * Endpoints:
 *   GET /health      — Render health check (200 OK)
 *   GET /api/status  — Live on-chain budget metrics & contract coordinates (read-only, no secrets)
 *   GET /api/abi     — Canonical AgentPay contract ABI (JSON)
 */

const http = require("http");
const { ethers } = require("ethers");
const { getContractConfig, loadAbi, validateNetworkConnection } = require("./src/config");

const PORT = parseInt(process.env.PORT || "10000", 10);
const HOST = "0.0.0.0";

const server = http.createServer(async (req, res) => {
  // Enable CORS for frontend clients
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  // ── 1. Health Check ────────────────────────────────────────────────────────
  if (url.pathname === "/health" || url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        service: "AgentPay Blockchain Service",
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV || "development",
      })
    );
    return;
  }

  // ── 2. Canonical ABI Endpoint ──────────────────────────────────────────────
  if (url.pathname === "/api/abi") {
    try {
      const abi = loadAbi();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ abi }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── 3. On-chain Status / Metrics Endpoint ──────────────────────────────────
  if (url.pathname === "/api/status") {
    try {
      const config = getContractConfig();
      const abi = loadAbi();

      let onChainData = null;

      // Query on-chain if RPC is provided
      if (config.rpcUrl) {
        try {
          const provider = new ethers.JsonRpcProvider(config.rpcUrl);
          const contract = new ethers.Contract(config.contractAddress, abi, provider);

          const [hardCap, budget, totalSpent, remaining] = await contract.getBudgetStatus();
          const agentAddress = await contract.agent();
          const balance = await contract.getContractBalance();

          onChainData = {
            hardSpendingCapWei: hardCap.toString(),
            hardSpendingCapEth: ethers.formatEther(hardCap),
            budgetWei: budget.toString(),
            budgetEth: ethers.formatEther(budget),
            totalSpentWei: totalSpent.toString(),
            totalSpentEth: ethers.formatEther(totalSpent),
            remainingBudgetWei: remaining.toString(),
            remainingBudgetEth: ethers.formatEther(remaining),
            vaultBalanceWei: balance.toString(),
            vaultBalanceEth: ethers.formatEther(balance),
            authorizedAgent: agentAddress,
          };
        } catch (chainErr) {
          onChainData = {
            error: "RPC query failed",
            details: chainErr.message,
          };
        }
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          contractAddress: config.contractAddress,
          chainId: config.chainId,
          source: config.source,
          isProduction: config.isProduction,
          onChain: onChainData,
        })
      );
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── 404 Not Found ──────────────────────────────────────────────────────────
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Endpoint not found", available: ["/health", "/api/abi", "/api/status"] }));
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`AgentPay service listening on http://${HOST}:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    try {
      const config = getContractConfig();
      console.log(`Contract Address: ${config.contractAddress} (${config.source})`);
      console.log(`Target Chain ID:  ${config.chainId}`);
    } catch (e) {
      console.warn(`Contract Config Warning: ${e.message}`);
    }
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("Shutting down AgentPay service...");
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

module.exports = server;
