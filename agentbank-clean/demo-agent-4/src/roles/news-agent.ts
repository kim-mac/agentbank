// news-agent.ts — Monitors market conditions and posts news to the group
// Run: npm run news

import { initAgent, postToGroup, runLoop, askClaude } from "../base-agent";

// Simulated news feed — in production this would call real APIs
// (CoinGecko, Messari, Twitter/X API, RSS feeds etc)
const NEWS_TOPICS = [
  "Solana network activity and transaction volume",
  "DeFi total value locked changes",
  "Major token price movements in the last hour",
  "Whale wallet movements on-chain",
  "New protocol launches or exploits",
  "Macro market conditions affecting crypto",
  "Prediction market sentiment on major assets",
];

async function main() {
  console.log("📰 News Agent starting...");
  const ctx = await initAgent();

  let topicIndex = 0;

  await runLoop(ctx, async (newMessages) => {
    // Rotate through topics
    const topic = NEWS_TOPICS[topicIndex % NEWS_TOPICS.length];
    topicIndex++;

    // Generate a news update for this topic
    const news = await askClaude(ctx,
      `Generate a realistic-sounding market news update about: "${topic}". 
       This is for a crypto trading team. Be specific with plausible numbers.
       Format: [HIGH/MEDIUM/LOW significance] Brief headline. 1-2 sentences of detail.
       Keep it under 3 sentences total.`
    );

    await postToGroup(ctx, `[NEWS] ${news}`);

    // If risk agent flagged something, acknowledge it
    const riskMessages = newMessages.filter(m =>
      m.senderRole === "risk" && m.content.includes("[VETO]")
    );
    for (const msg of riskMessages) {
      await postToGroup(ctx, `[NEWS] Noted risk veto. Continuing to monitor situation.`);
    }

  }, 25_000);
}

main().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
