// auto-agent.ts — Reads role from AgentBank and runs automatically
// This is the main entry point. It reads the role assigned in the dashboard
// and behaves accordingly. No hardcoding — the operator controls everything.
//
// Run: npm run auto
// Set AGENTBANK_API_KEY in .env — the rest is configured from the dashboard

import "dotenv/config";
import * as path from "path";
import { initAgent, postToGroup, runLoop, askClaude } from "./base-agent";

async function main() {
  console.log("\n🤖 AgentBank Auto-Agent");
  console.log("   Reading role from dashboard...\n");

  const ctx = await initAgent();

  if (!ctx.myRole || ctx.myRole === "assistant") {
    console.log("⚠️  No role assigned in dashboard.");
    console.log("   Go to: Dashboard → Agents → [your agent] → Role");
    console.log("   Assign a role and enable group collaboration, then restart.\n");
    process.exit(0);
  }

  if (!ctx.groupChannelId) {
    console.log("⚠️  Agent is not in a group.");
    console.log("   Go to: Dashboard → Agents → [your agent] → Role → enable Group collaboration\n");
    process.exit(0);
  }

  console.log(`📋 Role document loaded (${ctx.myRoleDocument.length} chars)`);
  console.log(`👥 Group: ${ctx.teammates.filter(t => !t.isSelf).length} teammates\n`);

  // Post startup message
  await postToGroup(ctx,
    `[${ctx.myRole.toUpperCase()}] ${ctx.agentName} online. Reading role document and joining group.`
  );

  // Get policy for context
  const policy = await ctx.wallet.policy() as any;
  const messaging = policy.messagingRule || {};
  const isExecutor = ctx.myRole === "execution";

  await runLoop(ctx, async (newMessages, allMessages) => {

    if (newMessages.length === 0 && !isExecutor) {
      // Proactive behavior based on role — post something useful unprompted
      const shouldPost = Math.random() < 0.3; // 30% chance each round
      if (shouldPost) {
        const proactive = await askClaude(ctx,
          `Based on your role as ${ctx.myRole} agent, post a brief, useful update to the team. ` +
          `Be specific and actionable. Keep it under 3 sentences. ` +
          `Tag your message type appropriately (e.g. [ANALYSIS], [NEWS], [RISK], [TRADING]).`,
          allMessages.slice(-4)
        );
        await postToGroup(ctx, proactive);
      }
      return;
    }

    // Build context string from recent messages
    const context = allMessages.slice(-8)
      .map(m => `[${m.senderName} (${m.senderRole || "?"})] ${m.content}`)
      .join("\n");

    // Check for action requests if executor
    if (isExecutor && messaging.canActOnMessages) {
      const actionRequests = newMessages.filter(m =>
        m.messageType === "action_request" ||
        (m.content.includes("ACTION:") && m.senderRole === "trading")
      );

      for (const msg of actionRequests) {
        const amountMatch = msg.content.match(/(\d+\.?\d*)\s*SOL/i);
        const amount = amountMatch ? parseFloat(amountMatch[1]) : 0.001;
        const safeAmount = Math.min(amount, policy.txLimit || 0.1);

        // Check risk approval
        const riskApproved = allMessages.slice(-10).some(m =>
          m.senderRole === "risk" && m.content.includes("[APPROVE")
        );

        if (!riskApproved) {
          await postToGroup(ctx, `[EXECUTION] ⛔ Waiting for risk approval before executing.`);
          continue;
        }

        try {
          await postToGroup(ctx, `[EXECUTION] 🔄 Executing ${safeAmount} SOL...`);
          const result = await ctx.wallet.send({
            to:     ctx.wallet.walletAddress,
            amount: safeAmount,
            token:  "SOL",
            memo:   `Auto-executed: ${msg.content.slice(0, 80)}`,
          }) as any;

          if (result.status === "confirmed") {
            await postToGroup(ctx,
              `[EXECUTION] ✅ Done: ${safeAmount} SOL | tx: ${result.txHash?.slice(0, 16)}...`,
              "action_result"
            );
          } else {
            await postToGroup(ctx, `[EXECUTION] ⚠️ Status: ${result.status} | ${result.reason || ""}`);
          }
        } catch (err: any) {
          await postToGroup(ctx, `[EXECUTION] ❌ ${err.message}`);
        }
      }
      return;
    }

    // For all other roles — respond to new messages with Gemini
    if (newMessages.length > 0) {
      const response = await askClaude(ctx,
        `Recent group discussion:\n${context}\n\n` +
        `New messages:\n${newMessages.map(m => `[${m.senderName}]: ${m.content}`).join("\n")}\n\n` +
        `As the ${ctx.myRole} agent, respond if you have something valuable to add. ` +
        `If no response is needed, reply with exactly: SILENT`,
        allMessages.slice(-6)
      );

      if (response !== "SILENT" && !response.startsWith("SILENT")) {
        const isAction = response.includes("ACTION:");
        await postToGroup(ctx, response, isAction ? "action_request" : "text");
      }
    }

  }, 20_000);
}

main().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
