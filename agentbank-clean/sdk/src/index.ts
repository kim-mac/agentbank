// AgentBank SDK — Non-custodial wallet for AI agents
//
// HOW IT WORKS:
//   1. First run: generates a Solana keypair locally, saves to .agent-key
//   2. Registers its PUBLIC address with AgentBank (private key never sent)
//   3. For every transaction:
//      a. Ask AgentBank: is this allowed? (policy check)
//      b. If yes: sign the tx locally with our own keypair
//      c. Broadcast the signed tx directly to Solana
//      d. Report the txHash back to AgentBank for audit tracking
//
// AgentBank never sees the private key. Ever.

import {
  Keypair,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from "@solana/web3.js";
import bs58 from "bs58";
import * as fs from "fs";
import * as path from "path";

const DEFAULT_API_URL = process.env.AGENTBANK_URL || "http://localhost:3001/v1";

// ── Types ──────────────────────────────────────────────────────────────────

export interface WalletInfo {
  agentId:       string;
  agentName:     string;
  walletAddress: string;
  chain:         string;
  balance:       { sol: number; lamports: number };
  policy: {
    dailyLimit:           number;
    dailySpent:           number;
    dailyRemaining:       number;
    txLimit:              number;
    requireApprovalAbove: number;
    allowedChains:        string[];
    whitelistedAddresses: string[];
    killSwitch:           boolean;
    agentStatus:          string;
  };
  status: string;
}

export interface SendResult {
  status:            "confirmed" | "rejected" | "pending_approval" | "failed";
  transactionId?:    string;
  txHash?:           string;
  explorerUrl?:      string;
  reason?:           string;
  message?:          string;
  approvalRequestId?: string;
}

export interface TransactionStatus {
  transactionId: string;
  status:        string;
  amount:        number;
  token:         string;
  toAddress:     string;
  fromAddress:   string;
  memo?:         string;
  txHash?:       string;
  rejectReason?: string;
  createdAt:     string;
  confirmedAt?:  string;
  explorerUrl?:  string;
  action?:       string;
}

// ── Key management — stays on this machine only ────────────────────────────

// Generate a unique key filename: agent_name_randomchars
// e.g. agent_trading-bot_a3f9k2.key
// This ensures multiple agents on the same machine never overwrite each other
export function generateKeyPath(agentName: string, dir = "."): string {
  const safe    = agentName.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 30);
  const random  = Math.random().toString(36).slice(2, 8); // 6 random chars
  return path.join(dir, `agent_${safe}_${random}.key`);
}

function loadOrCreateKeypair(keyPath: string): Keypair {
  const resolved = path.resolve(keyPath);
  if (fs.existsSync(resolved)) {
    const stored = fs.readFileSync(resolved, "utf-8").trim();
    return Keypair.fromSecretKey(bs58.decode(stored));
  }
  // First run — generate fresh keypair and save locally
  const keypair = Keypair.generate();
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, bs58.encode(keypair.secretKey), { mode: 0o600 }); // owner read-only
  console.log("[AgentWallet] New keypair generated");
  console.log(`[AgentWallet] Public address : ${keypair.publicKey.toString()}`);
  console.log(`[AgentWallet] Private key saved to: ${resolved}`);
  console.log("[AgentWallet] Keep this file safe — it controls your funds");
  return keypair;
}

// ── AgentWallet ────────────────────────────────────────────────────────────

export class AgentWallet {
  private agentApiKey: string;
  private baseUrl:     string;
  private keypair:     Keypair;
  private connection:  Connection;

  constructor(config: {
    agentApiKey:  string;   // from AgentBank registration
    keyPath?:     string;   // local file to store private key
                            // if omitted, auto-generates: agent_name_random.key
    agentName?:   string;   // used for auto key naming (e.g. "trading-bot")
    keyDir?:      string;   // directory for auto-named key (default: ".")
    baseUrl?:     string;   // AgentBank API URL
    rpcUrl?:      string;   // Solana RPC (default: devnet)
  }) {
    if (!config.agentApiKey) throw new Error("agentApiKey is required");
    this.agentApiKey = config.agentApiKey;
    this.baseUrl     = config.baseUrl || DEFAULT_API_URL;

    // Determine key path:
    // 1. Explicit keyPath → use as-is
    // 2. agentName provided → auto-generate: agent_name_random.key
    // 3. Neither → fall back to .agent-key (backwards compatible)
    let resolvedKeyPath: string;
    if (config.keyPath) {
      resolvedKeyPath = config.keyPath;
    } else if (config.agentName) {
      resolvedKeyPath = generateKeyPath(config.agentName, config.keyDir || ".");
      // But if a key already exists for this agent, find it
      const dir   = path.resolve(config.keyDir || ".");
      const name  = config.agentName.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 30);
      const existing = fs.existsSync(dir)
        ? fs.readdirSync(dir).find(f => f.startsWith(`agent_${name}_`) && f.endsWith(".key"))
        : undefined;
      if (existing) resolvedKeyPath = path.join(dir, existing);
    } else {
      resolvedKeyPath = "./.agent-key";
    }

    this.keypair    = loadOrCreateKeypair(resolvedKeyPath);
    this.connection = new Connection(config.rpcUrl || clusterApiUrl("devnet"), "confirmed");
  }

  get walletAddress(): string {
    return this.keypair.publicKey.toString();
  }

  // ── Internal API helper ────────────────────────────────────────────────

  private async api<T>(method: string, endpoint: string, body?: object): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${this.agentApiKey}` },
      ...(body && { body: JSON.stringify(body) }),
    });
    const data = await res.json() as T & { error?: string };
    if (!res.ok) throw new Error(`AgentBank error (${res.status}): ${(data as any).error}`);
    return data;
  }

  // ── Public methods ─────────────────────────────────────────────────────

  async info(): Promise<WalletInfo> {
    return this.api<WalletInfo>("GET", "/agent/wallet");
  }

  async balance() {
    return (await this.info()).balance;
  }

  async policy() {
    return this.api("GET", "/agent/policy");
  }

  // Dry-run: check if a send would be approved without signing anything
  async canSend(params: { to: string; amount: number; token?: string; memo?: string }) {
    return this.api<{ allowed: boolean; decision: string; reason?: string }>(
      "POST", "/agent/wallet/check",
      { toAddress: params.to, amount: params.amount, token: params.token || "SOL", memo: params.memo }
    );
  }

  // Full send flow:
  //   1. Request permission from AgentBank
  //   2. If approved: sign tx locally → broadcast → report txHash
  //   3. If pending_approval: return so caller can waitForApprovalAndSend()
  async send(params: {
    to:     string;
    amount: number;
    token?: string;
    memo:   string; // required — agent must explain every transaction
  }): Promise<SendResult> {
    const token = params.token || "SOL";

    const request = await this.api<any>("POST", "/agent/wallet/request", {
      toAddress: params.to, amount: params.amount, token, memo: params.memo,
    });

    if (request.status === "rejected") {
      return { status: "rejected", reason: request.reason };
    }

    if (request.status === "pending_approval") {
      return {
        status:            "pending_approval",
        transactionId:     request.transactionId,
        approvalRequestId: request.approvalRequestId,
        message:           request.message,
      };
    }

    if (request.status === "approved") {
      try {
        const txHash  = await this._signAndBroadcast(params.to, params.amount);
        const confirm = await this.api<any>("POST", "/agent/wallet/confirm", {
          transactionId: request.transactionId, txHash,
        });
        return { status: "confirmed", transactionId: request.transactionId, txHash, explorerUrl: confirm.explorerUrl };
      } catch (err: any) {
        return { status: "failed", reason: err.message };
      }
    }

    return { status: "failed", reason: "Unexpected response from AgentBank" };
  }

  // Wait for operator approval then sign and broadcast
  async waitForApprovalAndSend(
    transactionId: string,
    options: { timeoutMs?: number; pollIntervalMs?: number } = {}
  ): Promise<SendResult> {
    const timeout  = options.timeoutMs      || 10 * 60 * 1000; // 10 min
    const interval = options.pollIntervalMs || 5_000;           // 5s
    const start    = Date.now();

    console.log(`[AgentWallet] Waiting for operator approval: ${transactionId}`);

    while (Date.now() - start < timeout) {
      const tx = await this.txStatus(transactionId);

      if (tx.status === "rejected") {
        return { status: "rejected", reason: tx.rejectReason || "Rejected by operator" };
      }

      if (tx.status === "approved") {
        console.log("[AgentWallet] Approved — signing and broadcasting");
        try {
          const txHash  = await this._signAndBroadcast(tx.toAddress, tx.amount);
          const confirm = await this.api<any>("POST", "/agent/wallet/confirm", { transactionId, txHash });
          return { status: "confirmed", transactionId, txHash, explorerUrl: confirm.explorerUrl };
        } catch (err: any) {
          return { status: "failed", reason: err.message };
        }
      }

      await new Promise((r) => setTimeout(r, interval));
    }

    throw new Error(`Approval timeout after ${timeout}ms`);
  }

  async txStatus(transactionId: string): Promise<TransactionStatus> {
    return this.api<TransactionStatus>("GET", `/agent/wallet/tx/${transactionId}`);
  }

  async history(): Promise<TransactionStatus[]> {
    const res = await this.api<{ transactions: TransactionStatus[] }>("GET", "/agent/wallet/history");
    return res.transactions;
  }

  // ── Messaging ─────────────────────────────────────────────────────────

  // Send a DM to another agent
  async sendMessage(params: {
    toAgentId:    string;
    content:      string;
    messageType?: "text" | "action_request" | "action_result";
  }) {
    return this.api("POST", "/agent/messages/send", {
      toAgentId:   params.toAgentId,
      content:     params.content,
      messageType: params.messageType || "text",
    });
  }

  // Send to operator group channel
  async sendToGroup(params: { channelId: string; content: string; messageType?: "text"|"action_request"|"action_result" }) {
    return this.api("POST", "/agent/messages/send", {
      channelId:   params.channelId,
      content:     params.content,
      messageType: params.messageType || "text",
    });
  }

  // Get all messages (inbox + sent)
  async messages() {
    return this.api<{ messages: any[]; unreadCount: number }>("GET", "/agent/messages");
  }

  // Get unread messages only
  async unreadMessages() {
    return this.api<{ messages: any[]; count: number }>("GET", "/agent/messages/unread");
  }

  // Mark a message as read
  async markRead(messageId: string) {
    return this.api("POST", `/agent/messages/${messageId}/read`);
  }

  // Act on an action_request message — executes a transaction
  // The message content becomes the transaction memo automatically
  async actOnMessage(messageId: string, params: { toAddress: string; amount: number; token?: string }) {
    return this.api("POST", `/agent/messages/${messageId}/act`, {
      toAddress: params.toAddress,
      amount:    params.amount,
      token:     params.token || "SOL",
    });
  }

  // Get channel messages
  async channelMessages(channelId: string) {
    return this.api<{ messages: any[]; channelId: string }>("GET", `/agent/messages/channel/${channelId}`);
  }

  // ── Paper Trading ─────────────────────────────────────────────────────

  // Execute a paper trade (simulated, uses real market prices)
  async paperTrade(params: { tokenSymbol: string; side: "buy"|"sell"; amountSol: number; memo?: string }) {
    return this.api("POST", "/agent/paper/trade", params);
  }

  // Close an open paper position
  async closePaperTrade(tradeId: string) {
    return this.api("POST", `/agent/paper/trade/${tradeId}/close`, {});
  }

  // Get full paper trading portfolio with P&L
  async paperPortfolio() {
    return this.api("GET", "/agent/paper/portfolio");
  }

  // Get current price for a token
  async tokenPrice(symbol: string) {
    return this.api("GET", `/agent/paper/price/${symbol}`);
  }

  // ── Group collaboration ────────────────────────────────────────────────

  // Get all teammates in the group + my role document
  async groupDirectory() {
    return this.api<{
      groupChannelId: string;
      teammates:      any[];
      myRole:         string;
      myRoleDocument: string;
      inGroup:        boolean;
    }>("GET", "/agent/group/directory");
  }

  // Post a message to the operator group channel
  async postToGroup(channelId: string, content: string, messageType: "text"|"action_request"|"action_result" = "text") {
    return this.api("POST", "/agent/messages/send", { channelId, content, messageType });
  }

  // Start a group collaboration loop
  // Agent polls the group channel, processes messages based on its role,
  // and posts responses automatically
  async startGroupLoop(params: {
    onMessage:       (msg: any, directory: any) => Promise<string | null>;
    pollIntervalMs?: number;
    maxRounds?:      number; // safety limit — stops after N rounds
  }): Promise<void> {
    const interval  = params.pollIntervalMs || 10_000;
    const maxRounds = params.maxRounds      || 100;
    let   rounds    = 0;
    let   lastSeen  = new Date().toISOString();

    console.log("[AgentWallet] Starting group loop...");

    // Get directory on startup
    const dir = await this.groupDirectory();
    if (!dir.inGroup) {
      console.log("[AgentWallet] Agent is not in a group. Enable inGroup in dashboard.");
      return;
    }

    console.log(`[AgentWallet] Role: ${dir.myRole || "unassigned"} | Teammates: ${dir.teammates.length - 1}`);
    if (dir.myRoleDocument) {
      console.log("[AgentWallet] Role document loaded — agent knows its responsibilities");
    }

    // Cache agentId so we don't call info() inside filter
    const myInfo   = await this.info();
    const myAgentId = myInfo.agentId;

    while (rounds < maxRounds) {
      await new Promise(r => setTimeout(r, interval));
      rounds++;

      try {
        // Get new messages since last check
        const { messages } = await this.channelMessages(dir.groupChannelId);
        const newMessages   = messages.filter((m: any) =>
          m.createdAt > lastSeen &&
          m.senderAgentId !== myAgentId // don't respond to own messages
        );

        for (const msg of newMessages) {
          const response = await params.onMessage(msg, dir);
          if (response) {
            const msgType = response.startsWith("ACTION:") ? "action_request" : "text";
            await this.postToGroup(dir.groupChannelId, response.replace("ACTION:", "").trim(), msgType);
          }
          lastSeen = msg.createdAt;
        }
      } catch (err: any) {
        console.error("[AgentWallet] Group loop error:", err.message);
      }
    }

    console.log("[AgentWallet] Group loop ended (max rounds reached)");
  }

  async requestAirdrop(amountSol = 1): Promise<string> {
    const sig = await this.connection.requestAirdrop(this.keypair.publicKey, amountSol * LAMPORTS_PER_SOL);
    await this.connection.confirmTransaction(sig);
    console.log(`[AgentWallet] Airdropped ${amountSol} devnet SOL`);
    return sig;
  }

  // ── Private: sign and broadcast — private key never leaves this method ──

  private async _signAndBroadcast(toAddress: string, amountSol: number): Promise<string> {
    const toPubkey = new PublicKey(toAddress);
    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
    const { blockhash } = await this.connection.getLatestBlockhash();

    const tx        = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer        = this.keypair.publicKey;
    tx.add(SystemProgram.transfer({ fromPubkey: this.keypair.publicKey, toPubkey, lamports }));

    // Sign with our own keypair — never leaves this process
    const txHash = await sendAndConfirmTransaction(this.connection, tx, [this.keypair]);
    console.log(`[AgentWallet] Broadcast confirmed: ${txHash}`);
    return txHash;
  }
}

export default AgentWallet;
