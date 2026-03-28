// risk-agent.ts — Evaluates risk on every proposed trade
// Run: npm run risk

import { initAgent, postToGroup, runLoop, askClaude, GroupMessage } from "../base-agent";

async function main() {
  console.log("🛡️ Risk Agent starting...");
  const ctx = await initAgent();

  // Get current wallet state for risk context
  const info    = await ctx.wallet.info();
  const policy  = await ctx.wallet.policy() as any;

  await postToGroup(ctx,
    `[RISK] Risk agent online. Daily limit: ${policy.dailyLimit} SOL | ` +
    `Remaining: ${policy.dailyRemaining?.toFixed(3) || "?"} SOL | ` +
    `Balance: ${info.balance.sol.toFixed(4)} SOL`
  );

  await runLoop(ctx, async (newMessages, allMessages) => {
    // Watch for trading decisions that need risk assessment
    const tradingMessages = newMessages.filter(m =>
      (m.senderRole === "trading" || m.senderRole === "research") &&
      (m.content.includes("BUY") || m.content.includes("SELL") ||
       m.content.includes("ACTION:") || m.content.includes("recommend"))
    );

    for (const msg of tradingMessages) {
      // Get fresh policy data
      const freshPolicy = await ctx.wallet.policy() as any;
      const remaining   = freshPolicy.dailyRemaining || 0;

      const assessment = await askClaude(ctx,
        `A team member posted: "${msg.content}"\n\n` +
        `Current risk status:\n` +
        `- Daily limit remaining: ${remaining.toFixed(3)} SOL\n` +
        `- Balance: ${info.balance.sol.toFixed(4)} SOL\n\n` +
        `Evaluate this proposal. Should we proceed?\n` +
        `If yes: respond with [APPROVE: max X SOL] and brief reason.\n` +
        `If no: respond with [VETO: reason].\n` +
        `Keep under 2 sentences.`,
        allMessages.slice(-6)
      );

      await postToGroup(ctx, `[RISK] ${assessment}`);
    }

    // Proactive risk monitoring every few rounds
    if (newMessages.length === 0) {
      const freshPolicy = await ctx.wallet.policy() as any;
      const remaining   = freshPolicy.dailyRemaining || 0;
      const pct         = ((policy.dailyLimit - remaining) / policy.dailyLimit * 100);

      if (pct > 70) {
        await postToGroup(ctx,
          `[RISK] ⚠️ Daily spend at ${pct.toFixed(0)}% of limit. ` +
          `Only ${remaining.toFixed(3)} SOL remaining today. Recommend reducing position sizes.`
        );
      }
    }

  }, 18_000);
}

main().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
