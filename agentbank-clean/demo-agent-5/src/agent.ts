// agent.ts — Demo autonomous agent
// Reads AGENT_WALLET.md at startup, holds its own keypair, signs its own transactions.

import "dotenv/config";
import * as path from "path";
import * as fs from "fs";
import { AgentWallet } from "../../sdk/src/index";

async function runAgent() {
  console.log("\n🤖 AgentBank Demo Agent\n");

  // Read skill file (agent learns its capabilities)
  const skillPath = path.resolve(__dirname, "../../AGENT_WALLET.md");
  if (fs.existsSync(skillPath)) {
    console.log("📖 AGENT_WALLET.md loaded — agent knows how to use its wallet\n");
  }

  const apiKey  = process.env.AGENTBANK_API_KEY;
  const keyPath = process.env.AGENT_KEY_PATH || path.resolve(__dirname, "../.agent-key");

  if (!apiKey) {
    console.error("❌ Missing AGENTBANK_API_KEY — run: npm run setup");
    process.exit(1);
  }

  // Initialize wallet — loads or creates keypair locally
  const wallet = new AgentWallet({ agentApiKey: apiKey, keyPath });
  console.log(`🔑 Wallet address : ${wallet.walletAddress}`);
  console.log(`   Private key    : stays on this machine\n`);

  // Check wallet status
  console.log("📊 Checking wallet...");
  let info: any;
  try {
    info = await wallet.info();
  } catch (err: any) {
    console.error(`❌ Cannot reach AgentBank: ${err.message}`);
    console.error("   Start the backend: cd backend && npm run dev");
    process.exit(1);
  }

  console.log(`   Name:      ${info.agentName}`);
  console.log(`   Status:    ${info.status}`);
  console.log(`   Balance:   ${info.balance.sol} SOL`);
  console.log(`   Remaining: ${info.policy.dailyRemaining} / ${info.policy.dailyLimit} SOL today\n`);

  if (info.status !== "active") {
    console.log(`⏸  Agent is ${info.status}. Exiting.`); return;
  }

  // ── Policy checks (no spending) ─────────────────────────────────────────
  console.log("🧪 Policy Engine Tests\n");
  const tests = [
    { amount: 0.05,  label: "Small tx  → should be APPROVED" },
    { amount: 0.8,   label: "Medium tx → should need APPROVAL" },
    { amount: 999,   label: "Huge tx   → should be REJECTED" },
  ];
  for (const t of tests) {
    const r = await wallet.canSend({ to: wallet.walletAddress, amount: t.amount, memo: "test" });
    const icon = r.allowed ? "✅" : r.decision === "PENDING_APPROVAL" ? "⏳" : "❌";
    console.log(`${icon} ${t.label}`);
    console.log(`   ${t.amount} SOL → Decision: ${r.decision}${r.reason ? ` (${r.reason})` : ""}`);
  }
  console.log();

  // ── Real transaction (only if funded) ───────────────────────────────────
  if (info.balance.sol >= 0.01) {
    console.log("💸 Sending real devnet transaction (self-transfer)...");
    console.log("   1. Ask AgentBank: is this allowed?");
    console.log("   2. AgentBank checks policy → APPROVED");
    console.log("   3. Agent signs tx with its own private key");
    console.log("   4. Agent broadcasts signed tx to Solana");
    console.log("   5. Agent reports txHash to AgentBank\n");

    const result = await wallet.send({
      to:     wallet.walletAddress,
      amount: 0.5,
      token:  "SOL",
      memo:   "Self-test: verifying non-custodial wallet flow",
    });

    if (result.status === "confirmed") {
      console.log(`   ✅ Confirmed! TxHash: ${result.txHash}`);
      console.log(`   🔍 ${result.explorerUrl}\n`);
    } else if (result.status === "pending_approval") {
      console.log("   ⏳ Waiting for operator approval...");
      const final = await wallet.waitForApprovalAndSend(result.transactionId!);
      console.log(`   Result: ${final.status}${final.txHash ? ` | ${final.txHash}` : ""}\n`);
    } else {
      console.log(`   ❌ ${result.status}: ${result.reason}\n`);
    }
  } else {
    console.log("💧 No devnet SOL — requesting airdrop...");
    try {
      await wallet.requestAirdrop(1);
      console.log("   ✅ 1 SOL airdropped. Run again to test real transactions.\n");
    } catch (err: any) {
      console.log(`   ⚠️  Airdrop failed: ${err.message}`);
      console.log(`   → Fund manually: https://faucet.solana.com/?addr=${wallet.walletAddress}\n`);
    }
  }

  // ── History ─────────────────────────────────────────────────────────────
  const history = await wallet.history();
  console.log(`📜 Transaction history (${history.length} total):`);
  history.slice(0, 5).forEach(tx => {
    const icon = tx.status === "confirmed" ? "✅" : tx.status === "rejected" ? "❌" : "⏳";
    console.log(`   ${icon} ${tx.amount} SOL | ${tx.status} | "${tx.memo || "no memo"}"`);
  });

  console.log("\n✅ Done. AgentBank never touched your private key.\n");
}

runAgent().catch(err => { console.error("Agent error:", err.message); process.exit(1); });
