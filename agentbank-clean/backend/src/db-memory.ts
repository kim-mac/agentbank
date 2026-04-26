// db-memory.ts — In-memory store (resets on every restart)
import { v4 as uuidv4 } from "uuid";

export interface Operator {
  id: string; email: string; orgName: string; apiKey: string; createdAt: string;
}

export interface TimeRule {
  enabled:        boolean;
  startHour:      number;   // 0-23 UTC
  endHour:        number;   // 0-23 UTC
  blockWeekends:  boolean;
}

export interface BalanceRule {
  enabled:        boolean;
  minBalance:     number;   // auto-pause agent if balance drops below this (SOL)
}

export interface SpendThresholdRule {
  enabled:           boolean;
  approvalThreshold: number; // % of daily limit — require approval above this (0-100)
}

export interface PerAddressRule {
  enabled:       boolean;
  maxPerAddress: number;   // max SOL to any single address per day
  maxTxPerHour:  number;   // max transactions to same address per hour
}

export interface CategoryRule {
  enabled:             boolean;
  allowedCategories:   string[];  // e.g. ["dex", "prediction_market", "api"]
  blockUnknown:        boolean;   // block addresses not in any category
  categoryAddresses:   Record<string, string[]>; // category → [addresses]
}

export interface MessagingRule {
  allowMessages:     boolean;  // can receive messages at all
  canActOnMessages:  boolean;  // can execute transactions based on messages
  trustedSenders:    string[]; // agent IDs allowed to trigger actions (empty = all)
}

export interface Policy {
  // Basic (existing)
  dailyLimit:           number;
  txLimit:              number;
  whitelistedAddresses: string[];
  requireApprovalAbove: number;
  allowedChains:        string[];
  killSwitch:           boolean;
  // Advanced
  timeRule?:            TimeRule;
  balanceRule?:         BalanceRule;
  spendThresholdRule?:  SpendThresholdRule;
  perAddressRule?:      PerAddressRule;
  categoryRule?:        CategoryRule;
  // Messaging
  messagingRule?:       MessagingRule;
}

export interface Agent {
  id: string; operatorId: string; name: string; description: string;
  apiKey: string; walletAddress: string; chain: string;
  status: "active" | "paused" | "frozen";
  claimStatus:   "pending" | "claimed";
  claimToken:    string;
  claimedAt?:    string;
  roleName?:     string;
  roleDocument?: string;
  inGroup:       boolean;
  paperMode?:    boolean;
  paperBalance?: number;
  squadsEnabled?:          boolean;
  squadsMultisigPda?:      string;
  squadsVaultPda?:         string;
  squadsVaultIndex?:       number;
  squadsSpendingLimitPda?: string;
  squadsCreateKey?:        string;
  policy: Policy; createdAt: string;
}

export interface Transaction {
  id: string; agentId: string; chain: string; fromAddress: string;
  toAddress: string; amount: number; token: string;
  status: "pending_approval" | "approved" | "rejected" | "confirmed" | "failed";
  rejectReason?: string; txHash?: string; memo?: string;
  createdAt: string; confirmedAt?: string;
}

export interface ApprovalRequest {
  id: string; transactionId: string; agentId: string; operatorId: string;
  status: "pending" | "approved" | "rejected"; createdAt: string; respondedAt?: string;
}

export interface Message {
  id:               string;
  senderAgentId:    string;
  receiverAgentId?: string;
  channelId?:       string;
  channelType:      "dm" | "operator_group" | "public";
  content:          string;
  messageType:      "text" | "action_request" | "action_result";
  actedOn:          boolean;
  triggeredTxId?:   string;
  createdAt:        string;
  readAt?:          string;
}

export interface X402Payment {
  id: string;
  operatorId?: string;
  endpoint: string;
  network: string;
  amountAtomic: string;
  asset: string;
  payTo: string;
  payerAddress: string;
  nonce: string;
  authorizationValidAfter: string;
  authorizationValidBefore: string;
  paymentSignature: string;
  facilitatorVerified: boolean;
  facilitatorTxHash?: string;
  createdAt: string;
}

const operators        = new Map<string, Operator>();
const agents           = new Map<string, Agent>();
const transactions     = new Map<string, Transaction>();
const approvalRequests = new Map<string, ApprovalRequest>();
const dailySpend       = new Map<string, number>();
const messages         = new Map<string, Message>();
const x402Payments     = new Map<string, X402Payment>();

// ── Operators ──────────────────────────────────────────────────────────────
export function createOperator(email: string, orgName: string): Operator {
  const op: Operator = { id: uuidv4(), email, orgName, apiKey: `op_${uuidv4().replace(/-/g,"")}`, createdAt: new Date().toISOString() };
  operators.set(op.id, op); return op;
}
export function getOperatorByApiKey(apiKey: string): Operator | undefined { return [...operators.values()].find(o => o.apiKey === apiKey); }
export function getOperatorById(id: string): Operator | undefined { return operators.get(id); }
export function getOperatorAgents(operatorId: string): Agent[] { return [...agents.values()].filter(a => a.operatorId === operatorId && !a.apiKey.startsWith('deleted_')); }

// ── Agents ─────────────────────────────────────────────────────────────────
export function createAgent(params: {
  operatorId: string;
  name: string;
  description: string;
  walletAddress: string;
  chain: string;
  policy: Policy;
  claimStatus?: "pending"|"claimed";
  roleName?: string;
  roleDocument?: string;
  inGroup?: boolean;
  squadsEnabled?: boolean;
  squadsMultisigPda?: string;
  squadsVaultPda?: string;
  squadsVaultIndex?: number;
  squadsSpendingLimitPda?: string;
  squadsCreateKey?: string;
}): Agent {
  const agent: Agent = {
    id: uuidv4(), operatorId: params.operatorId, name: params.name,
    description: params.description, apiKey: `agent_${uuidv4().replace(/-/g,"")}`,
    walletAddress: params.walletAddress, chain: params.chain, status: "active",
    claimStatus: params.claimStatus || "claimed",
    claimToken: uuidv4().replace(/-/g,""),
    roleName:     params.roleName,
    roleDocument: params.roleDocument,
    inGroup:      params.inGroup || false,
    squadsEnabled:          params.squadsEnabled || false,
    squadsMultisigPda:      params.squadsMultisigPda,
    squadsVaultPda:         params.squadsVaultPda,
    squadsVaultIndex:       params.squadsVaultIndex ?? 0,
    squadsSpendingLimitPda: params.squadsSpendingLimitPda,
    squadsCreateKey:        params.squadsCreateKey,
    policy: params.policy, createdAt: new Date().toISOString(),
  };
  agents.set(agent.id, agent); return agent;
}
export function getAgentByApiKey(apiKey: string): Agent | undefined { return [...agents.values()].find(a => a.apiKey === apiKey); }
export function getAgentById(id: string): Agent | undefined { return agents.get(id); }
export function getAgentByClaimToken(token: string): Agent | undefined { return [...agents.values()].find(a => a.claimToken === token); }
export function updateAgentStatus(id: string, status: Agent["status"]): void { const a = agents.get(id); if (a) agents.set(id, {...a, status}); }
export function updateAgentPolicy(id: string, policy: Partial<Policy>): void { const a = agents.get(id); if (a) agents.set(id, {...a, policy: {...a.policy, ...policy}}); }
export function updateAgentSquads(id: string, updates: Partial<Pick<Agent, "squadsEnabled"|"squadsMultisigPda"|"squadsVaultPda"|"squadsVaultIndex"|"squadsSpendingLimitPda"|"squadsCreateKey">>): void {
  const a = agents.get(id);
  if (a) agents.set(id, { ...a, ...updates });
}
export function deleteAgent(id: string): void { agents.delete(id); }
export function updateAgentRole(id: string, roleName: string | undefined, roleDocument: string | undefined, inGroup: boolean): void {
  const a = agents.get(id);
  if (a) agents.set(id, { ...a, roleName, roleDocument, inGroup });
}
export function claimAgent(id: string): void {
  const a = agents.get(id);
  if (a) agents.set(id, {...a, claimStatus: "claimed", claimedAt: new Date().toISOString()});
}

// ── Transactions ───────────────────────────────────────────────────────────
export function createTransaction(data: Omit<Transaction,"id"|"createdAt">): Transaction {
  const tx: Transaction = {...data, id: uuidv4(), createdAt: new Date().toISOString()};
  transactions.set(tx.id, tx); return tx;
}
export function updateTransaction(id: string, updates: Partial<Transaction>): Transaction | undefined {
  const tx = transactions.get(id); if (!tx) return undefined;
  const updated = {...tx, ...updates}; transactions.set(id, updated); return updated;
}
export function getTransaction(id: string): Transaction | undefined { return transactions.get(id); }
export function getAgentTransactions(agentId: string): Transaction[] {
  return [...transactions.values()].filter(t => t.agentId === agentId).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
export function getOperatorTransactions(operatorId: string): Transaction[] {
  const agentIds = getOperatorAgents(operatorId).map(a => a.id);
  return [...transactions.values()].filter(t => agentIds.includes(t.agentId)).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}

// ── Daily spend ────────────────────────────────────────────────────────────
export function getTodaySpend(agentId: string): number {
  const today = new Date().toISOString().split("T")[0];
  return dailySpend.get(`${agentId}:${today}`) ?? 0;
}
// ── Messages ───────────────────────────────────────────────────────────────
export function createMessage(data: Omit<Message, "id" | "createdAt" | "actedOn">): Message {
  const msg: Message = { ...data, id: uuidv4(), createdAt: new Date().toISOString(), actedOn: false };
  messages.set(msg.id, msg); return msg;
}
export function getMessage(id: string): Message | undefined { return messages.get(id); }
export function markMessageRead(id: string): void {
  const m = messages.get(id); if (m) messages.set(id, { ...m, readAt: new Date().toISOString() });
}
export function markMessageActedOn(id: string, txId: string): void {
  const m = messages.get(id); if (m) messages.set(id, { ...m, actedOn: true, triggeredTxId: txId });
}
export function getAgentMessages(agentId: string): Message[] {
  return [...messages.values()]
    .filter(m => m.receiverAgentId === agentId || m.senderAgentId === agentId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function getChannelMessages(channelId: string, limit = 50): Message[] {
  return [...messages.values()]
    .filter(m => m.channelId === channelId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-limit);
}
export function getUnreadMessages(agentId: string): Message[] {
  return [...messages.values()]
    .filter(m => m.receiverAgentId === agentId && !m.readAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
// ── Paper Trading ──────────────────────────────────────────────────────────

export interface PaperTrade {
  id:             string;
  agentId:        string;
  tokenSymbol:    string;
  tokenId:        string;
  side:           "buy" | "sell";
  amountToken:    number;
  amountSol:      number;
  priceUsd:       number;
  priceSol?:      number;
  status:         "open" | "closed" | "cancelled";
  closePriceUsd?: number;
  closePriceSol?: number;
  pnlUsd?:        number;
  pnlPct?:        number;
  memo?:          string;
  openedAt:       string;
  closedAt?:      string;
}

const paperTrades = new Map<string, PaperTrade>();

export function createPaperTrade(data: Omit<PaperTrade, "id" | "openedAt" | "status">): PaperTrade {
  const trade: PaperTrade = { ...data, id: uuidv4(), status: "open", openedAt: new Date().toISOString() };
  paperTrades.set(trade.id, trade); return trade;
}
export function getPaperTrade(id: string): PaperTrade | undefined { return paperTrades.get(id); }
export function getAgentPaperTrades(agentId: string): PaperTrade[] {
  return [...paperTrades.values()].filter(t => t.agentId === agentId).sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}
export function closePaperTrade(id: string, closePriceUsd: number, closePriceSol: number): PaperTrade | undefined {
  const t = paperTrades.get(id); if (!t) return undefined;
  const pnlUsd = (closePriceUsd - t.priceUsd) * t.amountToken * (t.side === "buy" ? 1 : -1);
  const pnlPct = (pnlUsd / (t.priceUsd * t.amountToken)) * 100;
  const closed = { ...t, status: "closed" as const, closePriceUsd, closePriceSol, pnlUsd, pnlPct, closedAt: new Date().toISOString() };
  paperTrades.set(id, closed); return closed;
}
export function updateAgentPaperMode(id: string, paperMode: boolean, paperBalance: number): void {
  const a = agents.get(id); if (a) agents.set(id, { ...a, paperMode, paperBalance } as any);
}
export function getOperatorPaperTrades(operatorId: string): PaperTrade[] {
  const agentIds = getOperatorAgents(operatorId).map(a => a.id);
  return [...paperTrades.values()].filter(t => agentIds.includes(t.agentId)).sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

export function getOperatorMessages(operatorId: string): Message[] {
  return [...messages.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addToTodaySpend(agentId: string, amount: number): void {
  const today = new Date().toISOString().split("T")[0];
  const key = `${agentId}:${today}`;
  dailySpend.set(key, (dailySpend.get(key) ?? 0) + amount);
}

// ── Approvals ──────────────────────────────────────────────────────────────
export function createApprovalRequest(transactionId: string, agentId: string, operatorId: string): ApprovalRequest {
  const req: ApprovalRequest = { id: uuidv4(), transactionId, agentId, operatorId, status: "pending", createdAt: new Date().toISOString() };
  approvalRequests.set(req.id, req); return req;
}
export function getApprovalRequest(id: string): ApprovalRequest | undefined { return approvalRequests.get(id); }
export function updateApprovalRequest(id: string, status: "approved"|"rejected"): ApprovalRequest | undefined {
  const req = approvalRequests.get(id); if (!req) return undefined;
  const updated = {...req, status, respondedAt: new Date().toISOString()};
  approvalRequests.set(id, updated); return updated;
}
export function getPendingApprovals(operatorId: string): ApprovalRequest[] {
  return [...approvalRequests.values()].filter(r => r.operatorId === operatorId && r.status === "pending");
}

// ── x402 payments ───────────────────────────────────────────────────────────
export function createX402Payment(
  data: Omit<X402Payment, "id" | "createdAt">
): X402Payment {
  const payment: X402Payment = {
    ...data,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
  };
  x402Payments.set(payment.id, payment);
  return payment;
}

export function getX402PaymentByNonce(nonce: string): X402Payment | undefined {
  return [...x402Payments.values()].find((p) => p.nonce === nonce);
}

export function getX402RevenueStats(operatorId?: string): {
  totalPayments: number;
  totalAmountAtomic: string;
  byNetwork: Record<string, { count: number; amountAtomic: string }>;
  recentPayments: X402Payment[];
} {
  const filtered = [...x402Payments.values()]
    .filter((p) => !operatorId || p.operatorId === operatorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  let total = BigInt(0);
  const byNetwork: Record<string, { count: number; amountAtomic: string }> = {};
  for (const p of filtered) {
    total += BigInt(p.amountAtomic);
    const row = byNetwork[p.network] || { count: 0, amountAtomic: "0" };
    byNetwork[p.network] = {
      count: row.count + 1,
      amountAtomic: (BigInt(row.amountAtomic) + BigInt(p.amountAtomic)).toString(),
    };
  }

  return {
    totalPayments: filtered.length,
    totalAmountAtomic: total.toString(),
    byNetwork,
    recentPayments: filtered.slice(0, 20),
  };
}

export function listX402Payments(params: {
  operatorId: string;
  network?: string;
  fromDate?: string;
  toDate?: string;
  verified?: boolean;
  page: number;
  pageSize: number;
}): { items: X402Payment[]; total: number } {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  let rows = [...x402Payments.values()].filter((p) => p.operatorId === params.operatorId);
  if (params.network) rows = rows.filter((p) => p.network === params.network);
  if (params.verified === true) rows = rows.filter((p) => p.facilitatorVerified);
  if (params.verified === false) rows = rows.filter((p) => !p.facilitatorVerified);
  if (params.fromDate) {
    const start = `${params.fromDate}T00:00:00.000Z`;
    rows = rows.filter((p) => p.createdAt >= start);
  }
  if (params.toDate) {
    const end = `${params.toDate}T23:59:59.999Z`;
    rows = rows.filter((p) => p.createdAt <= end);
  }
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const total = rows.length;
  const offset = (page - 1) * pageSize;
  const items = rows.slice(offset, offset + pageSize);
  return { items, total };
}
