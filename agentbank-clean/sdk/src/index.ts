// AgentBank SDK — Non-custodial wallet for AI agents
//
// HOW IT WORKS:
//   1. First run: generates a keypair locally (Solana Ed25519 or EVM secp256k1)
//   2. Registers its PUBLIC address with AgentBank (private key never sent)
//   3. For every transaction:
//      a. Ask AgentBank: is this allowed? (policy check)
//      b. If yes: sign the tx locally with our own keypair
//      c. Broadcast the signed tx directly to the chain
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
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type PublicClient,
  type WalletClient,
  type Account,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { baseSepolia, base } from "viem/chains";
import bs58 from "bs58";
import * as fs from "fs";
import * as path from "path";

const DEFAULT_API_URL = process.env.AGENTBANK_URL || "http://localhost:3001/v1";

export type SupportedChain = "solana" | "base";

// ── Types ──────────────────────────────────────────────────────────────────

export interface WalletInfo {
  agentId:       string;
  agentName:     string;
  walletAddress: string;
  chain:         string;
  balance:       { native: number; unit: string };
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

// Generate a unique key filename: agent_name_randomchars.key (Solana) or .base.key (Base)
export function generateKeyPath(agentName: string, dir = ".", chain: SupportedChain = "solana"): string {
  const safe    = agentName.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 30);
  const random  = Math.random().toString(36).slice(2, 8);
  const ext     = chain === "base" ? ".base.key" : ".key";
  return path.join(dir, `agent_${safe}_${random}${ext}`);
}

function loadOrCreateSolanaKeypair(keyPath: string): Keypair {
  const resolved = path.resolve(keyPath);
  if (fs.existsSync(resolved)) {
    const stored = fs.readFileSync(resolved, "utf-8").trim();
    return Keypair.fromSecretKey(bs58.decode(stored));
  }
  const keypair = Keypair.generate();
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, bs58.encode(keypair.secretKey), { mode: 0o600 });
  console.log("[AgentWallet] New Solana keypair generated");
  console.log(`[AgentWallet] Public address : ${keypair.publicKey.toString()}`);
  console.log(`[AgentWallet] Private key saved to: ${resolved}`);
  console.log("[AgentWallet] Keep this file safe — it controls your funds");
  return keypair;
}

function loadOrCreateEvmAccount(keyPath: string): Account {
  const resolved = path.resolve(keyPath);
  if (fs.existsSync(resolved)) {
    const stored = fs.readFileSync(resolved, "utf-8").trim() as `0x${string}`;
    return privateKeyToAccount(stored);
  }
  const privateKey = generatePrivateKey();
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, privateKey, { mode: 0o600 });
  const account = privateKeyToAccount(privateKey);
  console.log("[AgentWallet] New EVM keypair generated");
  console.log(`[AgentWallet] Public address : ${account.address}`);
  console.log(`[AgentWallet] Private key saved to: ${resolved}`);
  console.log("[AgentWallet] Keep this file safe — it controls your funds");
  return account;
}

// ── AgentWallet ────────────────────────────────────────────────────────────

export class AgentWallet {
  private agentApiKey: string;
  private apiUrl:      string;
  readonly chain:      SupportedChain;

  // Solana (populated when chain === "solana")
  private solKeypair?:    Keypair;
  private solConnection?: Connection;

  // EVM / Base (populated when chain === "base")
  private evmAccount?:      Account;
  private evmWalletClient?: WalletClient;
  private evmPublicClient?: PublicClient;

  constructor(config: {
    agentApiKey:  string;
    chain?:       SupportedChain;
    keyPath?:     string;
    agentName?:   string;
    keyDir?:      string;
    baseUrl?:     string;
    rpcUrl?:      string;
    baseNetwork?: "sepolia" | "mainnet";
  }) {
    if (!config.agentApiKey) throw new Error("agentApiKey is required");
    this.agentApiKey = config.agentApiKey;
    this.apiUrl      = config.baseUrl || DEFAULT_API_URL;
    this.chain       = config.chain || "solana";

    const keyDir  = config.keyDir || ".";
    const keyExt  = this.chain === "base" ? ".base.key" : ".key";

    let resolvedKeyPath: string;
    if (config.keyPath) {
      resolvedKeyPath = config.keyPath;
    } else if (config.agentName) {
      const dir   = path.resolve(keyDir);
      const name  = config.agentName.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 30);
      const existing = fs.existsSync(dir)
        ? fs.readdirSync(dir).find(f => f.startsWith(`agent_${name}_`) && f.endsWith(keyExt))
        : undefined;
      resolvedKeyPath = existing
        ? path.join(dir, existing)
        : generateKeyPath(config.agentName, keyDir, this.chain);
    } else {
      resolvedKeyPath = this.chain === "base" ? "./.agent-base-key" : "./.agent-key";
    }

    if (this.chain === "base") {
      this.evmAccount = loadOrCreateEvmAccount(resolvedKeyPath);
      const network     = config.baseNetwork === "mainnet" ? base : baseSepolia;
      const rpc         = config.rpcUrl || (config.baseNetwork === "mainnet" ? "https://mainnet.base.org" : "https://sepolia.base.org");
      this.evmPublicClient = createPublicClient({ chain: network, transport: http(rpc) });
      this.evmWalletClient = createWalletClient({ account: this.evmAccount, chain: network, transport: http(rpc) });
    } else {
      this.solKeypair    = loadOrCreateSolanaKeypair(resolvedKeyPath);
      this.solConnection = new Connection(config.rpcUrl || clusterApiUrl("devnet"), "confirmed");
    }
  }

  get walletAddress(): string {
    if (this.chain === "base") return this.evmAccount!.address;
    return this.solKeypair!.publicKey.toString();
  }

  // ── Internal API helper ────────────────────────────────────────────────

  private async api<T>(method: string, endpoint: string, body?: object): Promise<T> {
    const res = await fetch(`${this.apiUrl}${endpoint}`, {
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
    const defaultToken = this.chain === "base" ? "ETH" : "SOL";
    return this.api<{ allowed: boolean; decision: string; reason?: string }>(
      "POST", "/agent/wallet/check",
      { toAddress: params.to, amount: params.amount, token: params.token || defaultToken, memo: params.memo }
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
    memo:   string;
  }): Promise<SendResult> {
    const defaultToken = this.chain === "base" ? "ETH" : "SOL";
    const token = params.token || defaultToken;

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
        const txHash = this.chain === "base"
          ? await this._signAndBroadcastEvm(params.to, params.amount)
          : await this._signAndBroadcastSolana(params.to, params.amount);
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
    const timeout  = options.timeoutMs      || 10 * 60 * 1000;
    const interval = options.pollIntervalMs || 5_000;
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
          const txHash = this.chain === "base"
            ? await this._signAndBroadcastEvm(tx.toAddress, tx.amount)
            : await this._signAndBroadcastSolana(tx.toAddress, tx.amount);
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

  async requestAirdrop(amount = 1): Promise<string> {
    if (this.chain === "base") {
      console.log("[AgentWallet] Base Sepolia faucets: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet");
      throw new Error("Airdrop not available on Base. Use a faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet");
    }
    const sig = await this.solConnection!.requestAirdrop(this.solKeypair!.publicKey, amount * LAMPORTS_PER_SOL);
    await this.solConnection!.confirmTransaction(sig);
    console.log(`[AgentWallet] Airdropped ${amount} devnet SOL`);
    return sig;
  }

  // ── Private: sign and broadcast — private key never leaves these methods ──

  private async _signAndBroadcastSolana(toAddress: string, amountSol: number): Promise<string> {
    const toPubkey = new PublicKey(toAddress);
    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
    const { blockhash } = await this.solConnection!.getLatestBlockhash();

    const tx        = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer        = this.solKeypair!.publicKey;
    tx.add(SystemProgram.transfer({ fromPubkey: this.solKeypair!.publicKey, toPubkey, lamports }));

    const txHash = await sendAndConfirmTransaction(this.solConnection!, tx, [this.solKeypair!]);
    console.log(`[AgentWallet] Solana broadcast confirmed: ${txHash}`);
    return txHash;
  }

  private async _signAndBroadcastEvm(toAddress: string, amountEth: number): Promise<string> {
    const txHash = await this.evmWalletClient!.sendTransaction({
      to:    toAddress as `0x${string}`,
      value: parseEther(String(amountEth)),
      chain: this.evmWalletClient!.chain,
      account: this.evmAccount!,
    });

    const receipt = await this.evmPublicClient!.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") throw new Error(`EVM transaction reverted: ${txHash}`);

    console.log(`[AgentWallet] Base broadcast confirmed: ${txHash}`);
    return txHash;
  }
}

export default AgentWallet;
