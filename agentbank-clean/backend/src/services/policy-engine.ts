// policy-engine.ts — Evaluates every transaction against all policy rules
// Returns APPROVED, REJECTED, or PENDING_APPROVAL
// Does NOT sign or broadcast — that is the agent's job

import * as db from "../db";
import * as solana from "./solana";

export interface TransactionRequest {
  agentId:   string;
  toAddress: string;
  amount:    number;
  token:     string;
  chain:     string;
  memo?:     string;
}

export type PolicyDecision =
  | { result: "APPROVED" }
  | { result: "REJECTED"; reason: string }
  | { result: "PENDING_APPROVAL"; transactionId: string; approvalRequestId: string };

export async function evaluatePolicy(req: TransactionRequest): Promise<PolicyDecision> {
  const agent = await db.getAgentById(req.agentId);
  if (!agent) return { result: "REJECTED", reason: "Agent not found" };
  const p = agent.policy;

  // ── Basic rules (original 7) ───────────────────────────────────────────

  // Rule 1 — Kill switch
  if (p.killSwitch || agent.status === "frozen") {
    return { result: "REJECTED", reason: "Agent is frozen by operator" };
  }

  // Rule 2 — Agent status
  if (agent.status === "paused") {
    return { result: "REJECTED", reason: "Agent is paused" };
  }

  // Rule 3 — Chain whitelist
  if (!p.allowedChains.includes(req.chain)) {
    return { result: "REJECTED", reason: `Chain '${req.chain}' not permitted. Allowed: [${p.allowedChains.join(", ")}]` };
  }

  // Rule 4 — Per-transaction limit
  if (req.amount > p.txLimit) {
    return { result: "REJECTED", reason: `Amount ${req.amount} exceeds per-tx limit of ${p.txLimit}` };
  }

  // Rule 5 — Daily spend limit
  const todaySpend = await db.getTodaySpend(req.agentId);
  if (todaySpend + req.amount > p.dailyLimit) {
    return { result: "REJECTED", reason: `Daily limit exceeded. Spent: ${todaySpend}, Limit: ${p.dailyLimit}` };
  }

  // Rule 6 — Address whitelist
  if (p.whitelistedAddresses.length > 0 && !p.whitelistedAddresses.includes(req.toAddress)) {
    return { result: "REJECTED", reason: `Address '${req.toAddress}' is not whitelisted` };
  }

  // ── Advanced rules (new 5) ─────────────────────────────────────────────

  // Rule 7 — Time-based rules
  if (p.timeRule?.enabled) {
    const now     = new Date();
    const hourUTC = now.getUTCHours();
    const dayUTC  = now.getUTCDay(); // 0=Sun, 6=Sat

    if (p.timeRule.blockWeekends && (dayUTC === 0 || dayUTC === 6)) {
      return { result: "REJECTED", reason: `Transactions blocked on weekends (UTC)` };
    }

    const { startHour, endHour } = p.timeRule;
    if (startHour < endHour) {
      // e.g. 9-17: block outside this range
      if (hourUTC < startHour || hourUTC >= endHour) {
        return { result: "REJECTED", reason: `Transactions only allowed ${startHour}:00-${endHour}:00 UTC. Current: ${hourUTC}:00 UTC` };
      }
    } else {
      // e.g. 22-6 (overnight): block inside the gap
      if (hourUTC >= endHour && hourUTC < startHour) {
        return { result: "REJECTED", reason: `Transactions only allowed ${startHour}:00-${endHour}:00 UTC. Current: ${hourUTC}:00 UTC` };
      }
    }
  }

  // Rule 8 — Balance threshold (auto-pause)
  if (p.balanceRule?.enabled) {
    const balance = await solana.getBalance(agent.walletAddress);
    if (balance.sol < p.balanceRule.minBalance) {
      // Auto-pause the agent
      await db.updateAgentStatus(req.agentId, "paused");
      return {
        result: "REJECTED",
        reason: `Balance (${balance.sol.toFixed(4)} SOL) is below minimum threshold (${p.balanceRule.minBalance} SOL). Agent auto-paused.`,
      };
    }
  }

  // Rule 9 — Spend threshold (require approval above % of daily limit)
  if (p.spendThresholdRule?.enabled) {
    const spendPct = ((todaySpend + req.amount) / p.dailyLimit) * 100;
    if (spendPct > p.spendThresholdRule.approvalThreshold) {
      const tx = await db.createTransaction({
        agentId: req.agentId, chain: req.chain, fromAddress: agent.walletAddress,
        toAddress: req.toAddress, amount: req.amount, token: req.token,
        status: "pending_approval",
        memo: `${req.memo} [spend threshold: ${spendPct.toFixed(0)}% of daily limit]`,
      });
      const approvalReq = await db.createApprovalRequest(tx.id, req.agentId, agent.operatorId);
      return {
        result: "PENDING_APPROVAL",
        transactionId: tx.id,
        approvalRequestId: approvalReq.id,
      };
    }
  }

  // Rule 10 — Per-address limits
  if (p.perAddressRule?.enabled) {
    // Check daily spend to this specific address
    const addressDailySpend = await getAddressDailySpend(req.agentId, req.toAddress);
    if (addressDailySpend + req.amount > p.perAddressRule.maxPerAddress) {
      return {
        result: "REJECTED",
        reason: `Per-address daily limit exceeded for ${req.toAddress.slice(0,8)}... (max: ${p.perAddressRule.maxPerAddress} SOL/day)`,
      };
    }

    // Check tx frequency to this address in the last hour
    const recentTxCount = await getRecentTxCountToAddress(req.agentId, req.toAddress, 60);
    if (recentTxCount >= p.perAddressRule.maxTxPerHour) {
      return {
        result: "REJECTED",
        reason: `Too many transactions to ${req.toAddress.slice(0,8)}... in the last hour (max: ${p.perAddressRule.maxTxPerHour}/hour)`,
      };
    }
  }

  // Rule 11 — Category rules
  if (p.categoryRule?.enabled) {
    const addressCategory = getCategoryForAddress(req.toAddress, p.categoryRule.categoryAddresses);

    if (!addressCategory) {
      if (p.categoryRule.blockUnknown) {
        return {
          result: "REJECTED",
          reason: `Address ${req.toAddress.slice(0,8)}... is not in any allowed category. Unknown addresses are blocked.`,
        };
      }
    } else if (!p.categoryRule.allowedCategories.includes(addressCategory)) {
      return {
        result: "REJECTED",
        reason: `Category '${addressCategory}' is not in allowed categories: [${p.categoryRule.allowedCategories.join(", ")}]`,
      };
    }
  }

  // ── Approval threshold (original rule 7, now rule 12) ─────────────────
  if (req.amount > p.requireApprovalAbove) {
    const tx = await db.createTransaction({
      agentId: req.agentId, chain: req.chain, fromAddress: agent.walletAddress,
      toAddress: req.toAddress, amount: req.amount, token: req.token,
      status: "pending_approval", memo: req.memo,
    });
    const approvalReq = await db.createApprovalRequest(tx.id, req.agentId, agent.operatorId);
    console.log(`[Policy] Approval required: agent=${agent.name} amount=${req.amount} → ${req.toAddress}`);
    return { result: "PENDING_APPROVAL", transactionId: tx.id, approvalRequestId: approvalReq.id };
  }

  console.log(`[Policy] APPROVED: agent=${agent.name} amount=${req.amount} → ${req.toAddress}`);
  return { result: "APPROVED" };
}

// ── Policy summary for agents ──────────────────────────────────────────────

export async function getPolicySummary(agentId: string) {
  const agent = await db.getAgentById(agentId);
  if (!agent) return null;
  const todaySpend = await db.getTodaySpend(agentId);
  return {
    dailyLimit:           agent.policy.dailyLimit,
    dailySpent:           todaySpend,
    dailyRemaining:       Math.max(0, agent.policy.dailyLimit - todaySpend),
    txLimit:              agent.policy.txLimit,
    requireApprovalAbove: agent.policy.requireApprovalAbove,
    allowedChains:        agent.policy.allowedChains,
    whitelistedAddresses: agent.policy.whitelistedAddresses,
    killSwitch:           agent.policy.killSwitch,
    agentStatus:          agent.status,
    // Advanced policy summaries
    timeRule:           agent.policy.timeRule,
    balanceRule:        agent.policy.balanceRule,
    spendThresholdRule: agent.policy.spendThresholdRule,
    perAddressRule:     agent.policy.perAddressRule,
    categoryRule:       agent.policy.categoryRule,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function getAddressDailySpend(agentId: string, toAddress: string): Promise<number> {
  const txs = await db.getAgentTransactions(agentId);
  const today = new Date().toISOString().split("T")[0];
  return txs
    .filter(t => t.toAddress === toAddress && t.status === "confirmed" && t.createdAt.startsWith(today))
    .reduce((sum, t) => sum + t.amount, 0);
}

async function getRecentTxCountToAddress(agentId: string, toAddress: string, minutes: number): Promise<number> {
  const txs = await db.getAgentTransactions(agentId);
  const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  return txs.filter(t =>
    t.toAddress === toAddress &&
    t.status === "confirmed" &&
    t.createdAt > cutoff
  ).length;
}

function getCategoryForAddress(address: string, categoryAddresses: Record<string, string[]>): string | null {
  for (const [category, addresses] of Object.entries(categoryAddresses)) {
    if (addresses.includes(address)) return category;
  }
  return null;
}
