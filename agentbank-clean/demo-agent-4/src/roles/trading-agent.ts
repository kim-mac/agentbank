// trading-agent.ts — Makes trading decisions based on research + news + risk
// Run: npm run trading

import { initAgent, postToGroup, runLoop, askClaude, GroupMessage } from "../base-agent";

async function main() {
  console.log("📈 Trading Agent starting...");
  const ctx = await initAgent();

  // Get execution agent ID from teammates
  const executionAgent = ctx.teammates.find((t: any) => t.roleName === "execution" && !t.isSelf);
  if (!executionAgent) {
    console.log("⚠️  No execution agent found in group. Decisions will be posted but not executed.");
  } else {
    console.log(`🔗 Execution agent: ${executionAgent.name} (${executionAgent.agentId})`);
  }

  let lastDecisionTime = 0;
  const DECISION_COOLDOWN = 60_000; // don't decide more than once per minute

  await runLoop(ctx, async (newMessages, allMessages) => {
    // Only decide when we have enough team input
    const hasResearch = allMessages.some(m => m.senderRole === "research" && m.content.includes("[ANALYSIS]"));
    const hasNews     = allMessages.some(m => m.senderRole === "news"     && m.content.includes("[NEWS]"));
    const hasRisk     = allMessages.some(m => m.senderRole === "risk"     && m.content.includes("[RISK]"));

    // Check if risk just approved something
    const riskApproval = newMessages.find(m =>
      m.senderRole === "risk" && m.content.includes("[APPROVE")
    );

    // Check if risk vetoed — respect it
    const riskVeto = newMessages.find(m =>
      m.senderRole === "risk" && m.content.includes("[VETO]")
    );

    if (riskVeto) {
      await postToGroup(ctx, `[TRADING] Risk veto acknowledged. Standing down on that position.`);
      return;
    }

    // Make a decision if we have team input and enough time has passed
    const now = Date.now();
    const shouldDecide = (hasResearch || hasNews) && hasRisk &&
                         (now - lastDecisionTime > DECISION_COOLDOWN) &&
                         newMessages.some(m => m.senderRole === "research" || m.senderRole === "risk");

    if (shouldDecide) {
      lastDecisionTime = now;

      const recentContext = allMessages.slice(-8)
        .map(m => `[${m.senderName} (${m.senderRole || "?"})]  ${m.content}`)
        .join("\n");

      const decision = await askClaude(ctx,
        `Based on the team discussion:\n${recentContext}\n\n` +
        `Make a specific trading decision. Choose ONE of:\n` +
        `A) Execute a small test trade (0.001-0.01 SOL) — if conditions are promising\n` +
        `B) Wait for more information — if conditions are unclear\n` +
        `C) Stand down — if risk is too high\n\n` +
        `If A: respond with exactly:\n` +
        `ACTION: [amount] SOL to [destination description] | Confidence: [%] | Reason: [brief]\n\n` +
        `If B or C: explain why in 1 sentence starting with [WAIT] or [STAND DOWN].`,
        allMessages.slice(-6)
      );

      if (decision.includes("ACTION:")) {
        await postToGroup(ctx, `[TRADING] ${decision}`, "action_request");
      } else {
        await postToGroup(ctx, `[TRADING] ${decision}`);
      }
    }

  }, 22_000);
}

main().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
