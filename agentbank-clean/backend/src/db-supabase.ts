// db-supabase.ts — Supabase implementation
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Private Client Management ──────────────────────────────────────────────

let instance: SupabaseClient | null = null;

/**
 * Singleton getter to prevent top-level initialization crashes.
 */
function getSupabase(): SupabaseClient {
  if (instance) return instance;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      `CRITICAL: Supabase credentials missing. URL: ${url ? 'OK' : 'MISSING'}, Key: ${key ? 'OK' : 'MISSING'}`
    );
  }

  instance = createClient(url, key);
  return instance;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface Operator { id: string; email: string; orgName: string; apiKey: string; createdAt: string; }
export interface TimeRule { enabled: boolean; startHour: number; endHour: number; blockWeekends: boolean; }
export interface BalanceRule { enabled: boolean; minBalance: number; }
export interface SpendThresholdRule { enabled: boolean; approvalThreshold: number; }
export interface PerAddressRule { enabled: boolean; maxPerAddress: number; maxTxPerHour: number; }
export interface CategoryRule { enabled: boolean; allowedCategories: string[]; blockUnknown: boolean; categoryAddresses: Record<string, string[]>; }

export interface Policy {
  dailyLimit: number; txLimit: number; whitelistedAddresses: string[];
  requireApprovalAbove: number; allowedChains: string[]; killSwitch: boolean;
  timeRule?: TimeRule; balanceRule?: BalanceRule; spendThresholdRule?: SpendThresholdRule;
  perAddressRule?: PerAddressRule; categoryRule?: CategoryRule;
  messagingRule?: { allowMessages: boolean; canActOnMessages: boolean; trustedSenders: string[]; };
}

export interface Agent {
  id: string; operatorId: string; name: string; description: string;
  apiKey: string; walletAddress: string; chain: string;
  status: "active" | "paused" | "frozen";
  claimStatus: "pending" | "claimed";
  claimToken: string; claimedAt?: string;
  roleName?: string; roleDocument?: string;
  inGroup: boolean; paperMode?: boolean; paperBalance?: number;
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
  status: "pending" | "approved" | "rejected";
  createdAt: string; respondedAt?: string;
}

export interface Message {
  id: string; senderAgentId: string; receiverAgentId?: string;
  channelId?: string; channelType: "dm"|"operator_group"|"public";
  content: string; messageType: "text"|"action_request"|"action_result";
  actedOn: boolean; triggeredTxId?: string; createdAt: string; readAt?: string;
}

export interface PaperTrade {
  id: string; agentId: string; tokenSymbol: string; tokenId: string;
  side: "buy"|"sell"; amountToken: number; amountSol: number;
  priceUsd: number; priceSol?: number;
  status: "open"|"closed"|"cancelled";
  closePriceUsd?: number; closePriceSol?: number;
  pnlUsd?: number; pnlPct?: number;
  memo?: string; openedAt: string; closedAt?: string;
}

// ── Mappers ───────────────────────────────────────────────────────────────

function mapOperator(row: any): Operator {
  return { id: row.id, email: row.email, orgName: row.org_name, apiKey: row.api_key, createdAt: row.created_at };
}

function mapAgent(row: any): Agent {
  return {
    id: row.id, operatorId: row.operator_id, name: row.name, description: row.description,
    apiKey: row.api_key, walletAddress: row.wallet_address, chain: row.chain,
    status: row.status, claimStatus: row.claim_status || "claimed", claimToken: row.claim_token || "",
    claimedAt: row.claimed_at, roleName: row.role_name || undefined, roleDocument: row.role_document || undefined,
    inGroup: row.in_group || false, paperMode: row.paper_mode || false,
    paperBalance: row.paper_balance !== undefined ? Number(row.paper_balance) : 100,
    createdAt: row.created_at,
    policy: {
      dailyLimit: Number(row.policy_daily_limit), txLimit: Number(row.policy_tx_limit),
      requireApprovalAbove: Number(row.policy_require_approval_above),
      whitelistedAddresses: row.policy_whitelisted_addresses || [],
      allowedChains: row.policy_allowed_chains || ["solana"],
      killSwitch: row.policy_kill_switch,
      timeRule: row.policy_time_rule || undefined,
      balanceRule: row.policy_balance_rule || undefined,
      spendThresholdRule: row.policy_spend_threshold || undefined,
      perAddressRule: row.policy_per_address_rule || undefined,
      categoryRule: row.policy_category_rule || undefined,
      messagingRule: row.policy_allow_messages !== undefined ? {
        allowMessages: row.policy_allow_messages ?? true,
        canActOnMessages: row.policy_can_act_on_messages ?? false,
        trustedSenders: row.policy_trusted_senders ?? [],
      } : undefined,
    },
  };
}

function mapTransaction(row: any): Transaction {
  return {
    id: row.id, agentId: row.agent_id, chain: row.chain, fromAddress: row.from_address,
    toAddress: row.to_address, amount: Number(row.amount), token: row.token,
    status: row.status, rejectReason: row.reject_reason, txHash: row.tx_hash,
    memo: row.memo, createdAt: row.created_at, confirmedAt: row.confirmed_at,
  };
}

function mapApproval(row: any): ApprovalRequest {
  return { id: row.id, transactionId: row.transaction_id, agentId: row.agent_id, operatorId: row.operator_id, status: row.status, createdAt: row.created_at, respondedAt: row.responded_at };
}

function mapMessage(row: any): Message {
  return { id: row.id, senderAgentId: row.sender_agent_id, receiverAgentId: row.receiver_agent_id, channelId: row.channel_id, channelType: row.channel_type, content: row.content, messageType: row.message_type, actedOn: row.acted_on || false, triggeredTxId: row.triggered_tx_id, createdAt: row.created_at, readAt: row.read_at };
}

function mapPaperTrade(row: any): PaperTrade {
  return { id: row.id, agentId: row.agent_id, tokenSymbol: row.token_symbol, tokenId: row.token_id, side: row.side, amountToken: Number(row.amount_token), amountSol: Number(row.amount_sol), priceUsd: Number(row.price_usd), priceSol: row.price_sol ? Number(row.price_sol) : undefined, status: row.status, closePriceUsd: row.close_price_usd ? Number(row.close_price_usd) : undefined, closePriceSol: row.close_price_sol ? Number(row.close_price_sol) : undefined, pnlUsd: row.pnl_usd ? Number(row.pnl_usd) : undefined, pnlPct: row.pnl_pct ? Number(row.pnl_pct) : undefined, memo: row.memo, openedAt: row.opened_at, closedAt: row.closed_at };
}

// ── Database Functions ─────────────────────────────────────────────────────

export async function createOperator(email: string, orgName: string): Promise<Operator> {
  const apiKey = `op_${crypto.randomUUID().replace(/-/g, "")}`;
  const { data, error } = await getSupabase().from("operators").insert({ email, org_name: orgName, api_key: apiKey }).select().single();
  if (error) throw new Error(`createOperator: ${error.message}`);
  return mapOperator(data);
}

export async function getOperatorByApiKey(apiKey: string): Promise<Operator | undefined> {
  const { data } = await getSupabase().from("operators").select().eq("api_key", apiKey).single();
  return data ? mapOperator(data) : undefined;
}

export async function getOperatorById(id: string): Promise<Operator | undefined> {
  const { data } = await getSupabase().from("operators").select().eq("id", id).single();
  return data ? mapOperator(data) : undefined;
}

export async function getOperatorAgents(operatorId: string): Promise<Agent[]> {
  const { data } = await getSupabase().from("agents").select().eq("operator_id", operatorId).not("api_key", "like", "deleted_%");
  return (data || []).map(mapAgent);
}

export async function createAgent(params: any): Promise<Agent> {
  const apiKey = `agent_${crypto.randomUUID().replace(/-/g, "")}`;
  const claimToken = crypto.randomUUID().replace(/-/g, "");
  const { data, error } = await getSupabase().from("agents").insert({
    operator_id: params.operatorId, name: params.name, description: params.description, api_key: apiKey, wallet_address: params.walletAddress, chain: params.chain, claim_status: params.claimStatus || "claimed", claim_token: claimToken,
    policy_daily_limit: params.policy.dailyLimit, policy_tx_limit: params.policy.txLimit, policy_require_approval_above: params.policy.requireApprovalAbove, policy_whitelisted_addresses: params.policy.whitelistedAddresses, policy_allowed_chains: params.policy.allowedChains, policy_kill_switch: params.policy.killSwitch,
  }).select().single();
  if (error) throw new Error(`createAgent: ${error.message}`);
  return mapAgent(data);
}

export async function getAgentByApiKey(apiKey: string): Promise<Agent | undefined> {
  const { data } = await getSupabase().from("agents").select().eq("api_key", apiKey).single();
  return data ? mapAgent(data) : undefined;
}

export async function getAgentById(id: string): Promise<Agent | undefined> {
  const { data } = await getSupabase().from("agents").select().eq("id", id).single();
  return data ? mapAgent(data) : undefined;
}

export async function createTransaction(data: any): Promise<Transaction> {
  const { data: row, error } = await getSupabase().from("transactions").insert({
    agent_id: data.agentId, chain: data.chain, from_address: data.fromAddress, to_address: data.toAddress, amount: data.amount, token: data.token, status: data.status,
  }).select().single();
  if (error) throw new Error(`createTransaction: ${error.message}`);
  return mapTransaction(row);
}

export async function getAgentTransactions(agentId: string): Promise<Transaction[]> {
  const { data } = await getSupabase().from("transactions").select().eq("agent_id", agentId).order("created_at", { ascending: false });
  return (data || []).map(mapTransaction);
}

export async function createMessage(data: any): Promise<Message> {
  const { data: row, error } = await getSupabase().from("messages").insert({
    sender_agent_id: data.senderAgentId, receiver_agent_id: data.receiverAgentId, channel_type: data.channelType, content: data.content, message_type: data.messageType,
  }).select().single();
  if (error) throw new Error(`createMessage: ${error.message}`);
  return mapMessage(row);
}

export async function getAgentMessages(agentId: string): Promise<Message[]> {
  const { data } = await getSupabase().from("messages").select().or(`sender_agent_id.eq.${agentId},receiver_agent_id.eq.${agentId}`).order("created_at", { ascending: false }).limit(50);
  return (data || []).map(mapMessage);
}

export async function getTodaySpend(agentId: string): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const { data } = await getSupabase().from("transactions").select("amount").eq("agent_id", agentId).eq("status", "confirmed").gte("created_at", `${today}T00:00:00.000Z`);
  return (data || []).reduce((sum: number, row: any) => sum + Number(row.amount), 0);
}

export async function updateAgentStatus(id: string, status: Agent["status"]): Promise<void> {
  await getSupabase().from("agents").update({ status }).eq("id", id);
}

// ── Added missing exports for the errors you received ──────────────────────

export async function updateAgentPolicy(id: string, policy: Partial<Policy>): Promise<void> {
  await getSupabase().from("agents").update(policy).eq("id", id);
}

export async function updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
  await getSupabase().from("transactions").update(updates).eq("id", id);
}

export async function getTransaction(id: string): Promise<Transaction | undefined> {
  const { data } = await getSupabase().from("transactions").select().eq("id", id).single();
  return data ? mapTransaction(data) : undefined;
}

export async function createApprovalRequest(txId: string, agentId: string, opId: string): Promise<void> {
  await getSupabase().from("approval_requests").insert({ transaction_id: txId, agent_id: agentId, operator_id: opId });
}

export async function markMessageRead(id: string): Promise<void> {
  await getSupabase().from("messages").update({ read_at: new Date().toISOString() }).eq("id", id);
}

export async function claimAgent(id: string): Promise<void> {
  await getSupabase().from("agents").update({ claim_status: "claimed" }).eq("id", id);
}
