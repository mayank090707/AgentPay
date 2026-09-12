/**
 * AgentPay — ABI Export Script
 *
 * Run this after `npx hardhat compile` to (re-)copy the ABI to artifacts-export/
 * without re-deploying.  Used during local development iteration.
 *
 * Usage:
 *   node scripts/exportAbi.js
 */

const fs   = require("fs");
const path = require("path");

const artifactPath = path.join(
  __dirname, "..", "artifacts", "contracts", "AgentPay.sol", "AgentPay.json"
);

const exportDir = path.join(__dirname, "..", "artifacts-export");

if (!fs.existsSync(artifactPath)) {
  console.error("❌ Artifact not found. Run `npx hardhat compile` first.");
  process.exit(1);
}

if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
fs.writeFileSync(
  path.join(exportDir, "AgentPay.json"),
  JSON.stringify({ abi: artifact.abi }, null, 2)
);

console.log("✅ ABI exported to artifacts-export/AgentPay.json");

// Also write a minimal interface summary for quick human reference
const functionSigs = artifact.abi
  .filter((e) => e.type === "function")
  .map((f) => {
    const params = f.inputs.map((i) => `${i.type} ${i.name}`).join(", ");
    const returns = f.outputs && f.outputs.length
      ? ` → (${f.outputs.map((o) => o.type).join(", ")})`
      : "";
    return `  ${f.stateMutability === "view" || f.stateMutability === "pure" ? "[view] " : "       "}${f.name}(${params})${returns}`;
  });

const eventSigs = artifact.abi
  .filter((e) => e.type === "event")
  .map((e) => {
    const params = e.inputs.map((i) => `${i.indexed ? "indexed " : ""}${i.type} ${i.name}`).join(", ");
    return `  ${e.name}(${params})`;
  });

console.log("\n── Functions ──────────────────────────────────────────────────");
functionSigs.forEach((s) => console.log(s));
console.log("\n── Events ─────────────────────────────────────────────────────");
eventSigs.forEach((s) => console.log(s));
