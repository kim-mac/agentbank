// base-agent.ts — Shared Gemini-powered agent base
// All role agents (research, news, risk, trading, execution) extend this

import "dotenv/config";
import * as path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AgentWallet } from "../../sdk/src/index";

export interface GroupMessage {
  id:          string;
  senderName:  string;
  senderRole?: string;
  content:     string;
  messageType: string;
  actedOn:     boolean;
  createdAt:   string;
}

export interface AgentContext {
  wallet:         AgentWallet;
  gemini:         GoogleGenerativeAI;
  myRole:         string;
  myRoleDocument: string;
  groupChannelId: string;
  teammates:      any[];
  agentId:        string;
  agentName:      string;
}

// ── Initialize agent with wallet + Gemini + role ────────────────────────────

export async function initAgent(): Promise<AgentContext> {
  const apiKey    = process.env.AGENTBANK_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const keyPath   = process.env.AGENT_KEY_PATH || path.resolve(__dirname, "../.agent-key");

  if (!apiKey)    { console.error("❌ Missing AGENTBANK_API_KEY"); process.exit(1); }
  if (!geminiKey) { console.error("❌ Missing GEMINI_API_KEY — get one free at aistudio.google.com"); process.exit(1); }

  const wallet = new AgentWallet({ agentApiKey: apiKey, keyPath });
  const gemini = new GoogleGenerativeAI(geminiKey);

  // Get wallet info + role from AgentBank
  const info = await wallet.info();
  if (info.status !== "active") {
    console.error(`❌ Agent is ${info.status}`); process.exit(1);
  }

  // Get group directory — role + teammates
  const dir = await wallet.groupDirectory();

  console.log(`\n🤖 ${info.agentName}`);
  console.log(`   Role:      ${dir.myRole || "unassigned"}`);
  console.log(`   In group:  ${dir.inGroup ? "yes" : "no"}`);
  console.log(`   Teammates: ${dir.teammates.filter((t: any) => !t.isSelf).map((t: any) => `${t.name} (${t.roleName || "?"})`).join(", ") || "none"}`);
  console.log(`   Balance:   ${info.balance.sol.toFixed(4)} SOL\n`);

  return {
    wallet,
    gemini,
    myRole:         dir.myRole         || "assistant",
    myRoleDocument: dir.myRoleDocument || "You are an autonomous AI agent.",
    groupChannelId: dir.groupChannelId,
    teammates:      dir.teammates,
    agentId:        info.agentId,
    agentName:      info.agentName,
  };
}

// ── Ask Gemini a question with full context ─────────────────────────────────

export async function askGemini(
  ctx:            AgentContext,
  prompt:         string,
  recentMessages: GroupMessage[] = []
): Promise<string> {
  const model = ctx.gemini.getGenerativeModel({
    model:             "gemini-1.5-flash",  // fast + free tier
    systemInstruction: ctx.myRoleDocument,
  });

  // Build context from recent group messages
  const history = recentMessages.slice(-8)
    .map(m => `[${m.senderName}${m.senderRole ? ` (${m.senderRole})` : ""}]: ${m.content}`)
    .join("\n");

  const fullPrompt = history
    ? `Recent group discussion:\n${history}\n\n${prompt}`
    : prompt;

  const result   = await model.generateContent(fullPrompt);
  return result.response.text().trim();
}

// ── Alias for consistency across role files ────────────────────────────────
export const askClaude = askGemini;

// ── Poll group channel for new messages ────────────────────────────────────

export async function getNewMessages(
  ctx:      AgentContext,
  lastSeen: string
): Promise<GroupMessage[]> {
  const { messages } = await ctx.wallet.channelMessages(ctx.groupChannelId) as any;
  return (messages || [])
    .filter((m: any) => m.createdAt > lastSeen && m.senderAgentId !== ctx.agentId)
    .sort((a: any, b: any) => a.createdAt.localeCompare(b.createdAt));
}

// ── Post to group channel ──────────────────────────────────────────────────

export async function postToGroup(
  ctx:         AgentContext,
  message:     string,
  messageType: "text" | "action_request" | "action_result" = "text"
): Promise<void> {
  await ctx.wallet.postToGroup(ctx.groupChannelId, message, messageType);
  console.log(`📢 [${ctx.agentName}]: ${message.slice(0, 80)}${message.length > 80 ? "..." : ""}`);
}

// ── Run agent loop ──────────────────────────────────────────────────────────

export async function runLoop(
  ctx:       AgentContext,
  onTick:    (newMessages: GroupMessage[], allMessages: GroupMessage[]) => Promise<void>,
  intervalMs = 15_000,
  maxRounds  = 50
): Promise<void> {
  let lastSeen = new Date(Date.now() - 60_000).toISOString();
  let rounds   = 0;

  console.log(`⏳ Running loop (${intervalMs / 1000}s interval, max ${maxRounds} rounds)...\n`);

  while (rounds < maxRounds) {
    await new Promise(r => setTimeout(r, intervalMs));
    rounds++;

    try {
      const { messages: allMessages } = await ctx.wallet.channelMessages(ctx.groupChannelId) as any;
      const newMessages = (allMessages || [])
        .filter((m: any) => m.createdAt > lastSeen && m.senderAgentId !== ctx.agentId)
        .sort((a: any, b: any) => a.createdAt.localeCompare(b.createdAt));

      if (newMessages.length > 0) {
        lastSeen = newMessages[newMessages.length - 1].createdAt;
        console.log(`\n📨 ${newMessages.length} new message(s):`);
        newMessages.forEach((m: any) =>
          console.log(`   [${m.senderName}${m.senderRole ? ` (${m.senderRole})` : ""}]: ${m.content.slice(0, 60)}...`)
        );
      }

      await onTick(newMessages, allMessages || []);
    } catch (err: any) {
      console.error(`❌ Loop error: ${err.message}`);
    }
  }

  console.log("\n✅ Loop ended.");
}
