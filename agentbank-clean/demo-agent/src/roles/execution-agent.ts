// execution-agent.ts — The ONLY agent that executes real transactions
// Watches for action_request messages from trading-agent and executes them
// Run: npm run execution

import { initAgent, postToGroup, runLoop, askClaude } from "../base-agent";

// Known Solana devnet addresses for testing
// In production: real DEX router addresses
const EXECUTION_TARGETS: Record<string, string> = {
  "self-test":  "", // filled in dynamically with own address
  "treasury":   "11111111111111111111111111111111", // system program (safe test target)
};

async function main() {
  console.log("⚡ Execution Agent starting...");
  const ctx = await initAgent();

  // Self-address for test transactions
  EXECUTION_TARGETS["self-test"] = ctx.wallet.walletAddress;

  // Verify this agent has canActOnMessages enabled
  const policy = await ctx.wallet.policy() as any;
  const messaging = policy.messagingRule || {};

  if (!messaging.canActOnMessages) {
    console.log("⚠️  canActOnMessages is disabled in policy.");
    console.log("   Enable it in the dashboard: Agents → Policy → Messaging settings");
    console.log("   Continuing in monitor-only mode...\n");
  } else {
    console.log("✅ canActOnMessages enabled — ready to execute\n");
  }

  // Get trusted trading agent
  const tradingAgent = ctx.teammates.find((t: any) => t.roleName === "trading" && !t.isSelf);
  if (tradingAgent) {
    console.log(`🔗 Trusted trading agent: ${tradingAgent.name}`);
  }

  await postToGroup(ctx,
    `[EXECUTION] Execution agent online. ` +
    `canActOnMessages: ${messaging.canActOnMessages ? "✅ enabled" : "❌ disabled"}. ` +
    `${messaging.canActOnMessages ? "Ready to execute authorized transactions." : "Monitor-only mode."}`
  );

  await runLoop(ctx, async (newMessages, allMessages) => {
    // Watch for action_request messages from trading agent
    const actionRequests = newMessages.filter(m =>
      m.messageType === "action_request" ||
      (m.senderRole === "trading" && m.content.includes("ACTION:"))
    );

    for (const msg of actionRequests) {
      console.log(`\n⚡ Action request received from ${msg.senderName}: ${msg.content.slice(0, 80)}`);

      // Verify risk agent approved in recent messages
      const recentRiskApproval = allMessages
        .slice(-10)
        .find(m => m.senderRole === "risk" && m.content.includes("[APPROVE"));

      if (!recentRiskApproval) {
        await postToGroup(ctx,
          `[EXECUTION] ⛔ Cannot execute — no risk approval found in recent messages. ` +
          `Waiting for risk agent to review.`
        );
        continue;
      }

      // Parse amount from the message
      // Looks for patterns like "0.001 SOL" or "ACTION: 0.001 SOL"
      const amountMatch = msg.content.match(/(\d+\.?\d*)\s*SOL/i);
      const amount = amountMatch ? parseFloat(amountMatch[1]) : null;

      if (!amount || amount <= 0) {
        await postToGroup(ctx, `[EXECUTION] ⛔ Could not parse transaction amount from: "${msg.content.slice(0, 60)}"`);
        continue;
      }

      // Safety cap — never execute more than txLimit regardless of instruction
      const txLimit = policy.txLimit || 0.1;
      const safeAmount = Math.min(amount, txLimit);

      if (safeAmount !== amount) {
        await postToGroup(ctx,
          `[EXECUTION] ⚠️ Requested ${amount} SOL exceeds tx limit. Capping at ${safeAmount} SOL.`
        );
      }

      if (!messaging.canActOnMessages) {
        await postToGroup(ctx,
          `[EXECUTION] 📋 Would execute: ${safeAmount} SOL | Blocked — canActOnMessages disabled. ` +
          `Enable in dashboard to allow real execution.`
        );
        continue;
      }

      // Execute the transaction — self-transfer as safe devnet test
      try {
        await postToGroup(ctx, `[EXECUTION] 🔄 Executing: ${safeAmount} SOL self-transfer (devnet test)...`);

        const result = await ctx.wallet.send({
          to:     ctx.wallet.walletAddress, // self-transfer for safety
          amount: safeAmount,
          token:  "SOL",
          memo:   `Executed per trading-agent: ${msg.content.slice(0, 80)}`,
        }) as any;

        if (result.status === "confirmed") {
          await postToGroup(ctx,
            `[EXECUTION] ✅ Executed: ${safeAmount} SOL | TxHash: ${result.txHash?.slice(0, 20)}...`,
            "action_result"
          );
        } else if (result.status === "pending_approval") {
          await postToGroup(ctx,
            `[EXECUTION] ⏳ Transaction requires operator approval. TxId: ${result.transactionId}`
          );
        } else {
          await postToGroup(ctx,
            `[EXECUTION] ❌ Failed: ${result.reason}`
          );
        }
      } catch (err: any) {
        await postToGroup(ctx, `[EXECUTION] ❌ Error: ${err.message}`);
      }
    }

  }, 12_000); // shorter interval — execution agent should be responsive
}

main().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
