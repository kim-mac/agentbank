// db-supabase.ts — Supabase implementation
// Drop-in replacement for db.ts — same function signatures, persistent storage.
// Switch between them in db.ts by changing one import line.

//import { createClient } from "@supabase/supabase-js";

//const supabaseUrl = process.env.SUPABASE_URL!;
//const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

//if (!supabaseUrl || !supabaseKey) {
//  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment");
//}

//export const supabase = createClient(supabaseUrl, supabaseKey);

import { createClient } from "@supabase/supabase-js";

// DO NOT use the ! operator here, as it hides the error from TS but crashes at runtime
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "";

// Only initialize if we have the credentials
export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null as any; 

// Add a helper to prevent "undefined" errors later
if (!supabase) {
  console.warn("⚠️ Supabase client initialized with missing credentials. Ensure environment variables are set.");
}

// ── Types (same as db.ts) ──────────────────────────────────────────────────

export interface Operator {
  id:         string;
  email:      string;
  orgName:    string;
  apiKey:     string;
  createdAt:  string;
}

export interface Policy {
  dailyLimit:           number;
  txLimit:              number;
  whitelistedAddresses: string[];
  requireApprovalAbove: number;
  allowedChains:        string[];
  killSwitch:           boolean;
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

export interface Message {
  id: string; senderAgentId: string; receiverAgentId?: string;
  channelId?: string; channelType: "dm"|"operator_group"|"public";
  content: string; messageType: "text"|"action_request"|"action_result";
  actedOn: boolean; triggeredTxId?: string; createdAt: string; readAt?: string;
}

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
  id:            string;
  operatorId:    string;
  name:          string;
  description:   string;
  apiKey:        string;
  walletAddress: string;
  chain:         string;
  status:        "active" | "paused" | "frozen";
  claimStatus:   "pending" | "claimed";
  claimToken:    string;
  claimedAt?:    string;
  roleName?:     string;
  roleDocument?: string;
  inGroup:       boolean;
  paperMode?:    boolean;
  paperBalance?: number;
  policy:        Policy;
  createdAt:     string;
}

export interface Transaction {
  id:           string;
  agentId:      string;
  chain:        string;
  fromAddress:  string;
  toAddress:    string;
  amount:       number;
  token:        string;
  status:       "pending_approval" | "approved" | "rejected" | "confirmed" | "failed";
  rejectReason?: string;
  txHash?:      string;
  memo?:        string;
  createdAt:    string;
  confirmedAt?: string;
}

export interface ApprovalRequest {
  id:            string;
  transactionId: string;
  agentId:       string;
  operatorId:    string;
  status:        "pending" | "approved" | "rejected";
  createdAt:     string;
  respondedAt?:  string;
}

// ── Row mappers (snake_case DB → camelCase app) ────────────────────────────

function mapOperator(row: any): Operator {
  return {
    id:        row.id,
    email:     row.email,
    orgName:   row.org_name,
    apiKey:    row.api_key,
    createdAt: row.created_at,
  };
}

function mapAgent(row: any): Agent {
  return {
    id:            row.id,
    operatorId:    row.operator_id,
    name:          row.name,
    description:   row.description,
    apiKey:        row.api_key,
    walletAddress: row.wallet_address,
    chain:         row.chain,
    status:        row.status,
    claimStatus:   row.claim_status || "claimed",
    claimToken:    row.claim_token  || "",
    claimedAt:     row.claimed_at,
    roleName:      row.role_name     || undefined,
    roleDocument:  row.role_document || undefined,
    inGroup:       row.in_group      || false,
    paperMode:     row.paper_mode    || false,
    paperBalance:  row.paper_balance !== undefined ? Number(row.paper_balance) : 100,
    createdAt:     row.created_at,
    policy: {
      dailyLimit:           Number(row.policy_daily_limit),
      txLimit:              Number(row.policy_tx_limit),
      requireApprovalAbove: Number(row.policy_require_approval_above),
      whitelistedAddresses: row.policy_whitelisted_addresses || [],
      allowedChains:        row.policy_allowed_chains || ["solana"],
      killSwitch:           row.policy_kill_switch,
      timeRule:             row.policy_time_rule         || undefined,
      balanceRule:          row.policy_balance_rule      || undefined,
      spendThresholdRule:   row.policy_spend_threshold   || undefined,
      perAddressRule:       row.policy_per_address_rule  || undefined,
      categoryRule:         row.policy_category_rule     || undefined,
      messagingRule:        row.policy_allow_messages !== undefined ? {
        allowMessages:    row.policy_allow_messages    ?? true,
        canActOnMessages: row.policy_can_act_on_messages ?? false,
        trustedSenders:   row.policy_trusted_senders   ?? [],
      } : undefined,
    },
  };
}

function mapTransaction(row: any): Transaction {
  return {
    id:           row.id,
    agentId:      row.agent_id,
    chain:        row.chain,
    fromAddress:  row.from_address,
    toAddress:    row.to_address,
    amount:       Number(row.amount),
    token:        row.token,
    status:       row.status,
    rejectReason: row.reject_reason,
    txHash:       row.tx_hash,
    memo:         row.memo,
    createdAt:    row.created_at,
    confirmedAt:  row.confirmed_at,
  };
}

function mapApproval(row: any): ApprovalRequest {
  return {
    id:            row.id,
    transactionId: row.transaction_id,
    agentId:       row.agent_id,
    operatorId:    row.operator_id,
    status:        row.status,
    createdAt:     row.created_at,
    respondedAt:   row.responded_at,
  };
}

// ── Operators ──────────────────────────────────────────────────────────────

export async function createOperator(email: string, orgName: string): Promise<Operator> {
  const apiKey = `op_${crypto.randomUUID().replace(/-/g, "")}`;
  const { data, error } = await supabase
    .from("operators")
    .insert({ email, org_name: orgName, api_key: apiKey })
    .select()
    .single();
  if (error) throw new Error(`createOperator: ${error.message}`);
  return mapOperator(data);
}

export async function getOperatorByApiKey(apiKey: string): Promise<Operator | undefined> {
  const { data } = await supabase
    .from("operators")
    .select()
    .eq("api_key", apiKey)
    .single();
  return data ? mapOperator(data) : undefined;
}

export async function getOperatorById(id: string): Promise<Operator | undefined> {
  const { data } = await supabase.from("operators").select().eq("id", id).single();
  return data ? mapOperator(data) : undefined;
}

export async function getOperatorAgents(operatorId: string): Promise<Agent[]> {
  const { data } = await supabase.from("agents").select()
    .eq("operator_id", operatorId)
    .not("api_key", "like", "deleted_%"); // filter out soft-deleted agents
  return (data || []).map(mapAgent);
}

// ── Agents ─────────────────────────────────────────────────────────────────

export async function createAgent(params: {
  operatorId:    string;
  name:          string;
  description:   string;
  walletAddress: string;
  chain:         string;
  claimStatus?:  "pending" | "claimed";
  roleName?:     string;
  roleDocument?: string;
  inGroup?:      boolean;
  policy:        Policy;
}): Promise<Agent> {
  const apiKey      = `agent_${crypto.randomUUID().replace(/-/g, "")}`;
  const claimToken  = crypto.randomUUID().replace(/-/g, "");
  const { data, error } = await supabase
    .from("agents")
    .insert({
      operator_id:                    params.operatorId,
      name:                           params.name,
      description:                    params.description,
      api_key:                        apiKey,
      wallet_address:                 params.walletAddress,
      chain:                          params.chain,
      claim_status:                   params.claimStatus || "claimed",
      claim_token:                    claimToken,
      policy_daily_limit:             params.policy.dailyLimit,
      policy_tx_limit:                params.policy.txLimit,
      policy_require_approval_above:  params.policy.requireApprovalAbove,
      policy_whitelisted_addresses:   params.policy.whitelistedAddresses,
      policy_allowed_chains:          params.policy.allowedChains,
      policy_kill_switch:             params.policy.killSwitch,
      role_name:                      params.roleName     || null,
      role_document:                  params.roleDocument || null,
      in_group:                       params.inGroup      || false,
      policy_time_rule:               params.policy.timeRule        || null,
      policy_balance_rule:            params.policy.balanceRule     || null,
      policy_spend_threshold:         params.policy.spendThresholdRule || null,
      policy_per_address_rule:        params.policy.perAddressRule  || null,
      policy_category_rule:           params.policy.categoryRule    || null,
    })
    .select()
    .single();
  if (error) throw new Error(`createAgent: ${error.message}`);
  return mapAgent(data);
}

export async function getAgentByApiKey(apiKey: string): Promise<Agent | undefined> {
  const { data } = await supabase.from("agents").select().eq("api_key", apiKey).single();
  return data ? mapAgent(data) : undefined;
}

export async function getAgentById(id: string): Promise<Agent | undefined> {
  const { data } = await supabase.from("agents").select().eq("id", id).single();
  return data ? mapAgent(data) : undefined;
}

export async function updateAgentStatus(id: string, status: Agent["status"]): Promise<void> {
  await supabase.from("agents").update({ status }).eq("id", id);
}

export async function updateAgentPolicy(id: string, policy: Partial<Policy>): Promise<void> {
  const updates: Record<string, any> = {};
  if (policy.dailyLimit           !== undefined) updates.policy_daily_limit            = policy.dailyLimit;
  if (policy.txLimit              !== undefined) updates.policy_tx_limit               = policy.txLimit;
  if (policy.requireApprovalAbove !== undefined) updates.policy_require_approval_above = policy.requireApprovalAbove;
  if (policy.whitelistedAddresses !== undefined) updates.policy_whitelisted_addresses  = policy.whitelistedAddresses;
  if (policy.allowedChains        !== undefined) updates.policy_allowed_chains         = policy.allowedChains;
  if (policy.killSwitch           !== undefined) updates.policy_kill_switch            = policy.killSwitch;
  if (policy.timeRule             !== undefined) updates.policy_time_rule               = policy.timeRule;
  if (policy.balanceRule          !== undefined) updates.policy_balance_rule            = policy.balanceRule;
  if (policy.spendThresholdRule   !== undefined) updates.policy_spend_threshold         = policy.spendThresholdRule;
  if (policy.perAddressRule       !== undefined) updates.policy_per_address_rule        = policy.perAddressRule;
  if (policy.categoryRule         !== undefined) updates.policy_category_rule           = policy.categoryRule;
  if ((policy as any).messagingRule !== undefined) {
    const mr = (policy as any).messagingRule;
    if (mr !== undefined) {
      updates.policy_allow_messages      = mr.allowMessages;
      updates.policy_can_act_on_messages = mr.canActOnMessages;
      updates.policy_trusted_senders     = mr.trustedSenders || [];
    }
  }
  await supabase.from("agents").update(updates).eq("id", id);
}

// ── Transactions ───────────────────────────────────────────────────────────

export async function createTransaction(
  data: Omit<Transaction, "id" | "createdAt">
): Promise<Transaction> {
  const { data: row, error } = await supabase
    .from("transactions")
    .insert({
      agent_id:     data.agentId,
      chain:        data.chain,
      from_address: data.fromAddress,
      to_address:   data.toAddress,
      amount:       data.amount,
      token:        data.token,
      status:       data.status,
      reject_reason: data.rejectReason,
      tx_hash:      data.txHash,
      memo:         data.memo,
      confirmed_at: data.confirmedAt,
    })
    .select()
    .single();
  if (error) throw new Error(`createTransaction: ${error.message}`);
  return mapTransaction(row);
}

export async function updateTransaction(
  id: string,
  updates: Partial<Transaction>
): Promise<Transaction | undefined> {
  const dbUpdates: Record<string, any> = {};
  if (updates.status       !== undefined) dbUpdates.status        = updates.status;
  if (updates.txHash       !== undefined) dbUpdates.tx_hash       = updates.txHash;
  if (updates.rejectReason !== undefined) dbUpdates.reject_reason = updates.rejectReason;
  if (updates.confirmedAt  !== undefined) dbUpdates.confirmed_at  = updates.confirmedAt;

  const { data, error } = await supabase
    .from("transactions")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`updateTransaction: ${error.message}`);
  return mapTransaction(data);
}

export async function getTransaction(id: string): Promise<Transaction | undefined> {
  const { data } = await supabase.from("transactions").select().eq("id", id).single();
  return data ? mapTransaction(data) : undefined;
}

export async function getAgentTransactions(agentId: string): Promise<Transaction[]> {
  const { data } = await supabase
    .from("transactions")
    .select()
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  return (data || []).map(mapTransaction);
}

export async function getOperatorTransactions(operatorId: string): Promise<Transaction[]> {
  const agents = await getOperatorAgents(operatorId);
  const agentIds = agents.map((a) => a.id);
  if (!agentIds.length) return [];
  const { data } = await supabase
    .from("transactions")
    .select()
    .in("agent_id", agentIds)
    .order("created_at", { ascending: false });
  return (data || []).map(mapTransaction);
}

// ── Daily spend tracking ───────────────────────────────────────────────────
// We derive this from the transactions table — no separate table needed.

export async function getTodaySpend(agentId: string): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("transactions")
    .select("amount")
    .eq("agent_id", agentId)
    .eq("status", "confirmed")
    .gte("created_at", `${today}T00:00:00.000Z`)
    .lte("created_at", `${today}T23:59:59.999Z`);
  return (data || []).reduce((sum, row) => sum + Number(row.amount), 0);
}

export async function addToTodaySpend(_agentId: string, _amount: number): Promise<void> {
  // No-op: spend is derived from confirmed transactions in getTodaySpend()
  // We keep this function for interface compatibility with db.ts
}

// ── Approval requests ──────────────────────────────────────────────────────

export async function createApprovalRequest(
  transactionId: string,
  agentId: string,
  operatorId: string
): Promise<ApprovalRequest> {
  const { data, error } = await supabase
    .from("approval_requests")
    .insert({ transaction_id: transactionId, agent_id: agentId, operator_id: operatorId })
    .select()
    .single();
  if (error) throw new Error(`createApprovalRequest: ${error.message}`);
  return mapApproval(data);
}

export async function getApprovalRequest(id: string): Promise<ApprovalRequest | undefined> {
  const { data } = await supabase.from("approval_requests").select().eq("id", id).single();
  return data ? mapApproval(data) : undefined;
}

export async function updateApprovalRequest(
  id: string,
  status: "approved" | "rejected"
): Promise<ApprovalRequest | undefined> {
  const { data, error } = await supabase
    .from("approval_requests")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`updateApprovalRequest: ${error.message}`);
  return mapApproval(data);
}

export async function getPendingApprovals(operatorId: string): Promise<ApprovalRequest[]> {
  const { data } = await supabase
    .from("approval_requests")
    .select()
    .eq("operator_id", operatorId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data || []).map(mapApproval);
}

// ── Messages ───────────────────────────────────────────────────────────────

function mapMessage(row: any): Message {
  return {
    id: row.id, senderAgentId: row.sender_agent_id,
    receiverAgentId: row.receiver_agent_id, channelId: row.channel_id,
    channelType: row.channel_type, content: row.content,
    messageType: row.message_type, actedOn: row.acted_on || false,
    triggeredTxId: row.triggered_tx_id, createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export async function createMessage(data: Omit<Message, "id"|"createdAt"|"actedOn">): Promise<Message> {
  const { data: row, error } = await supabase.from("messages").insert({
    sender_agent_id:   data.senderAgentId,
    receiver_agent_id: data.receiverAgentId || null,
    channel_id:        data.channelId || null,
    channel_type:      data.channelType,
    content:           data.content,
    message_type:      data.messageType,
    triggered_tx_id:   data.triggeredTxId || null,
  }).select().single();
  if (error) throw new Error(`createMessage: ${error.message}`);
  return mapMessage(row);
}

export async function getMessage(id: string): Promise<Message | undefined> {
  const { data } = await supabase.from("messages").select().eq("id", id).single();
  return data ? mapMessage(data) : undefined;
}

export async function markMessageRead(id: string): Promise<void> {
  await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", id);
}

export async function markMessageActedOn(id: string, txId: string): Promise<void> {
  await supabase.from("messages").update({ acted_on: true, triggered_tx_id: txId }).eq("id", id);
}

export async function getAgentMessages(agentId: string): Promise<Message[]> {
  const { data } = await supabase.from("messages").select()
    .or(`sender_agent_id.eq.${agentId},receiver_agent_id.eq.${agentId}`)
    .order("created_at", { ascending: false }).limit(50);
  return (data || []).map(mapMessage);
}

export async function getChannelMessages(channelId: string, limit = 50): Promise<Message[]> {
  const { data } = await supabase.from("messages").select()
    .eq("channel_id", channelId).order("created_at", { ascending: true }).limit(limit);
  return (data || []).map(mapMessage);
}

export async function getUnreadMessages(agentId: string): Promise<Message[]> {
  const { data } = await supabase.from("messages").select()
    .eq("receiver_agent_id", agentId).is("read_at", null)
    .order("created_at", { ascending: true });
  return (data || []).map(mapMessage);
}

export async function getOperatorMessages(operatorId: string): Promise<Message[]> {
  // Get all agents for this operator then their messages
  const agents = await getOperatorAgents(operatorId);
  const agentIds = agents.map(a => a.id);
  if (!agentIds.length) return [];
  const { data } = await supabase.from("messages").select()
    .or(agentIds.map(id => `sender_agent_id.eq.${id},receiver_agent_id.eq.${id},channel_id.eq.${id}`).join(","))
    .order("created_at", { ascending: false }).limit(100);
  return (data || []).map(mapMessage);
}

// ── Claim functions (added for Phase 2) ────────────────────────────────────

export async function getAgentByClaimToken(token: string): Promise<Agent | undefined> {
  const { data } = await supabase.from("agents").select().eq("claim_token", token).single();
  return data ? mapAgent(data) : undefined;
}

export async function updateAgentRole(id: string, roleName: string | undefined, roleDocument: string | undefined, inGroup: boolean): Promise<void> {
  await supabase.from("agents").update({
    role_name:     roleName     || null,
    role_document: roleDocument || null,
    in_group:      inGroup,
  }).eq("id", id);
}

export async function deleteAgent(id: string): Promise<void> {
  // Soft delete — add deleted_at timestamp, keep for audit trail
  await supabase.from("agents").update({
    status:     "frozen",
    api_key:    `deleted_${id}`, // invalidate the API key immediately
  }).eq("id", id);
}

// ── Paper Trading ──────────────────────────────────────────────────────────

function mapPaperTrade(row: any): PaperTrade {
  return {
    id: row.id, agentId: row.agent_id, tokenSymbol: row.token_symbol,
    tokenId: row.token_id, side: row.side, amountToken: Number(row.amount_token),
    amountSol: Number(row.amount_sol), priceUsd: Number(row.price_usd),
    priceSol: row.price_sol ? Number(row.price_sol) : undefined,
    status: row.status, closePriceUsd: row.close_price_usd ? Number(row.close_price_usd) : undefined,
    closePriceSol: row.close_price_sol ? Number(row.close_price_sol) : undefined,
    pnlUsd: row.pnl_usd ? Number(row.pnl_usd) : undefined,
    pnlPct: row.pnl_pct ? Number(row.pnl_pct) : undefined,
    memo: row.memo, openedAt: row.opened_at, closedAt: row.closed_at,
  };
}

export async function createPaperTrade(data: Omit<PaperTrade, "id"|"openedAt"|"status">): Promise<PaperTrade> {
  const { data: row, error } = await supabase.from("paper_trades").insert({
    agent_id: data.agentId, token_symbol: data.tokenSymbol, token_id: data.tokenId,
    side: data.side, amount_token: data.amountToken, amount_sol: data.amountSol,
    price_usd: data.priceUsd, price_sol: data.priceSol || null, memo: data.memo || null,
  }).select().single();
  if (error) throw new Error(`createPaperTrade: ${error.message}`);
  return mapPaperTrade(row);
}

export async function getPaperTrade(id: string): Promise<PaperTrade | undefined> {
  const { data } = await supabase.from("paper_trades").select().eq("id", id).single();
  return data ? mapPaperTrade(data) : undefined;
}

export async function getAgentPaperTrades(agentId: string): Promise<PaperTrade[]> {
  const { data } = await supabase.from("paper_trades").select()
    .eq("agent_id", agentId).order("opened_at", { ascending: false });
  return (data || []).map(mapPaperTrade);
}

export async function closePaperTrade(id: string, closePriceUsd: number, closePriceSol: number): Promise<PaperTrade | undefined> {
  const trade = await getPaperTrade(id);
  if (!trade) return undefined;
  const pnlUsd = (closePriceUsd - trade.priceUsd) * trade.amountToken * (trade.side === "buy" ? 1 : -1);
  const pnlPct = (pnlUsd / (trade.priceUsd * trade.amountToken)) * 100;
  const { data } = await supabase.from("paper_trades").update({
    status: "closed", close_price_usd: closePriceUsd, close_price_sol: closePriceSol,
    pnl_usd: pnlUsd, pnl_pct: pnlPct, closed_at: new Date().toISOString(),
  }).eq("id", id).select().single();
  return data ? mapPaperTrade(data) : undefined;
}

export async function updateAgentPaperMode(id: string, paperMode: boolean, paperBalance: number): Promise<void> {
  await supabase.from("agents").update({
    paper_mode: paperMode, paper_balance: paperBalance,
  }).eq("id", id);
}

export async function getOperatorPaperTrades(operatorId: string): Promise<PaperTrade[]> {
  const agents = await getOperatorAgents(operatorId);
  const ids = agents.map(a => a.id);
  if (!ids.length) return [];
  const { data } = await supabase.from("paper_trades").select()
    .in("agent_id", ids).order("opened_at", { ascending: false });
  return (data || []).map(mapPaperTrade);
}

export async function claimAgent(id: string): Promise<void> {
  await supabase.from("agents").update({
    claim_status: "claimed",
    claimed_at: new Date().toISOString(),
  }).eq("id", id);
}
