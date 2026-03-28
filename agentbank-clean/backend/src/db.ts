// db.ts — Database switcher
import * as inMemory   from "./db-memory";
import * as supabaseDb from "./db-supabase";

const USE_SUPABASE = process.env.USE_SUPABASE === "true";

if (USE_SUPABASE) {
  console.log("[DB] Using Supabase — data persists across restarts ✅");
} else {
  console.log("[DB] Using in-memory store — data resets on restart ⚠️");
}

export type { Operator, Agent, Policy, Transaction, ApprovalRequest, Message, PaperTrade } from "./db-memory";

const db = USE_SUPABASE ? supabaseDb : inMemory;

export const createOperator          = db.createOperator;
export const getOperatorByApiKey     = db.getOperatorByApiKey;
export const getOperatorById         = db.getOperatorById;
export const getOperatorAgents       = db.getOperatorAgents;
export const createAgent             = db.createAgent;
export const getAgentByApiKey        = db.getAgentByApiKey;
export const getAgentById            = db.getAgentById;
export const getAgentByClaimToken    = db.getAgentByClaimToken;
export const updateAgentStatus       = db.updateAgentStatus;
export const updateAgentPolicy       = db.updateAgentPolicy;
export const updateAgentRole         = db.updateAgentRole;
export const createPaperTrade        = db.createPaperTrade;
export const getPaperTrade           = db.getPaperTrade;
export const getAgentPaperTrades     = db.getAgentPaperTrades;
export const closePaperTrade         = db.closePaperTrade;
export const updateAgentPaperMode    = db.updateAgentPaperMode;
export const getOperatorPaperTrades  = db.getOperatorPaperTrades;
export const deleteAgent             = db.deleteAgent;
export const createMessage           = db.createMessage;
export const getMessage              = db.getMessage;
export const markMessageRead         = db.markMessageRead;
export const markMessageActedOn      = db.markMessageActedOn;
export const getAgentMessages        = db.getAgentMessages;
export const getChannelMessages      = db.getChannelMessages;
export const getUnreadMessages       = db.getUnreadMessages;
export const getOperatorMessages     = db.getOperatorMessages;
export const claimAgent              = db.claimAgent;
export const createTransaction       = db.createTransaction;
export const updateTransaction       = db.updateTransaction;
export const getTransaction          = db.getTransaction;
export const getAgentTransactions    = db.getAgentTransactions;
export const getOperatorTransactions = db.getOperatorTransactions;
export const getTodaySpend           = db.getTodaySpend;
export const addToTodaySpend         = db.addToTodaySpend;
export const createApprovalRequest   = db.createApprovalRequest;
export const getApprovalRequest      = db.getApprovalRequest;
export const updateApprovalRequest   = db.updateApprovalRequest;
export const getPendingApprovals     = db.getPendingApprovals;
