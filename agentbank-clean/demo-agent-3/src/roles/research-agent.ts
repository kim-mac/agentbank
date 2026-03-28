// research-agent.ts — Analyzes market data and posts findings to the group
// Run: npm run research

import { initAgent, postToGroup, runLoop, askClaude, GroupMessage } from "../base-agent";

async function main() {
  console.log("🔬 Research Agent starting...");
  const ctx = await initAgent();

  // Post an initial analysis on startup
  const opening = await askClaude(ctx,
    "You are starting your shift. Post a brief market overview to the group to get the team oriented. Keep it under 3 sentences."
  );
  await postToGroup(ctx, `[ANALYSIS] ${opening}`);

  let roundCount = 0;

  await runLoop(ctx, async (newMessages, allMessages) => {
    roundCount++;

    // Respond to news from news-agent
    const newsMessages = newMessages.filter(m =>
      m.senderRole === "news" || m.content.includes("[NEWS]")
    );

    for (const msg of newsMessages) {
      const analysis = await askClaude(ctx,
        `A news agent just posted: "${msg.content}"\n\nProvide a brief technical analysis of the market implications. State your confidence level (0-100%). Keep it under 4 sentences.`,
        allMessages.slice(-6)
      );
      await postToGroup(ctx, `[ANALYSIS] ${analysis}`);
    }

    // Every 3 rounds, post a proactive insight
    if (roundCount % 3 === 0 && newMessages.length === 0) {
      const insight = await askClaude(ctx,
        `Based on general market knowledge, post one specific data point or pattern worth monitoring right now. Be specific and actionable. Under 3 sentences.`,
        allMessages.slice(-4)
      );
      await postToGroup(ctx, `[INSIGHT] ${insight}`);
    }

  }, 20_000);
}

main().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
