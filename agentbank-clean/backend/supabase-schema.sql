-- AgentBank Database Schema
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor → New Query)

-- ── Operators ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operators (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  org_name    TEXT NOT NULL,
  api_key     TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Agents ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id     UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT DEFAULT '',
  api_key         TEXT UNIQUE NOT NULL,
  wallet_address  TEXT NOT NULL,
  chain           TEXT NOT NULL DEFAULT 'solana',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','frozen')),
  -- Policy fields (stored flat for simplicity)
  policy_daily_limit            NUMERIC NOT NULL DEFAULT 1.0,
  policy_tx_limit               NUMERIC NOT NULL DEFAULT 0.1,
  policy_require_approval_above NUMERIC NOT NULL DEFAULT 0.5,
  policy_whitelisted_addresses  TEXT[]  NOT NULL DEFAULT '{}',
  policy_allowed_chains         TEXT[]  NOT NULL DEFAULT '{solana}',
  policy_kill_switch            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Transactions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  chain         TEXT NOT NULL,
  from_address  TEXT NOT NULL,
  to_address    TEXT NOT NULL,
  amount        NUMERIC NOT NULL,
  token         TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('pending_approval','approved','rejected','confirmed','failed')),
  reject_reason TEXT,
  tx_hash       TEXT,
  memo          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at  TIMESTAMPTZ
);

-- ── Approval Requests ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  operator_id     UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  responded_at    TIMESTAMPTZ
);

-- ── Indexes for fast queries ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_agents_operator_id      ON agents(operator_id);
CREATE INDEX IF NOT EXISTS idx_agents_api_key          ON agents(api_key);
CREATE INDEX IF NOT EXISTS idx_transactions_agent_id   ON transactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approvals_operator_id   ON approval_requests(operator_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status        ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_operators_api_key       ON operators(api_key);

-- ── Row Level Security (RLS) ────────────────────────────────────────────────
-- Disable RLS for now since we use service role key from backend
-- Enable later when adding user auth
ALTER TABLE operators         DISABLE ROW LEVEL SECURITY;
ALTER TABLE agents            DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      DISABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests DISABLE ROW LEVEL SECURITY;

-- ── Migration: Add claim fields to agents table ─────────────────────────────
-- Run this if you already have the agents table created
ALTER TABLE agents ADD COLUMN IF NOT EXISTS claim_status TEXT NOT NULL DEFAULT 'claimed' CHECK (claim_status IN ('pending','claimed'));
ALTER TABLE agents ADD COLUMN IF NOT EXISTS claim_token  TEXT UNIQUE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS claimed_at   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_agents_claim_token ON agents(claim_token);

-- ── Public registration endpoint (no operator key needed) ───────────────────
-- Agents call this to self-register. claim_status starts as 'pending'.

-- ── Migration: Advanced Policy Fields ──────────────────────────────────────
-- Run this in Supabase SQL Editor
ALTER TABLE agents ADD COLUMN IF NOT EXISTS policy_time_rule        JSONB;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS policy_balance_rule     JSONB;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS policy_spend_threshold  JSONB;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS policy_per_address_rule JSONB;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS policy_category_rule    JSONB;

-- ── Migration: Agent Messaging ─────────────────────────────────────────────
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS messages (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sender_agent_id   TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  receiver_agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
  channel_id        TEXT,  -- null for DMs, operator_id for group, 'public_id' for public
  channel_type      TEXT NOT NULL DEFAULT 'dm' CHECK (channel_type IN ('dm','operator_group','public')),
  content           TEXT NOT NULL,
  message_type      TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','action_request','action_result')),
  acted_on          BOOLEAN DEFAULT FALSE,
  triggered_tx_id   TEXT REFERENCES transactions(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  read_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_receiver    ON messages(receiver_agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel     ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender      ON messages(sender_agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_created     ON messages(created_at DESC);

-- ── Migration: Messaging Policy Fields ────────────────────────────────────
ALTER TABLE agents ADD COLUMN IF NOT EXISTS policy_allow_messages     BOOLEAN DEFAULT TRUE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS policy_can_act_on_messages BOOLEAN DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS policy_trusted_senders    JSONB DEFAULT '[]';

-- ── Migration: Agent Roles + Collaboration ─────────────────────────────────
ALTER TABLE agents ADD COLUMN IF NOT EXISTS role_name     TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS role_document TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS in_group      BOOLEAN DEFAULT FALSE;

-- ── Migration: Paper Trading ───────────────────────────────────────────────
ALTER TABLE agents ADD COLUMN IF NOT EXISTS paper_mode         BOOLEAN DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS paper_balance      NUMERIC DEFAULT 100.0; -- virtual SOL
ALTER TABLE agents ADD COLUMN IF NOT EXISTS paper_balance_usd  NUMERIC DEFAULT 10000.0; -- virtual USD

-- ── Migration: Squads vault metadata (Solana only) ─────────────────────────
ALTER TABLE agents ADD COLUMN IF NOT EXISTS squads_enabled             BOOLEAN DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS squads_multisig_pda        TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS squads_vault_pda           TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS squads_vault_index         INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS squads_spending_limit_pda  TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS squads_create_key          TEXT;

CREATE TABLE IF NOT EXISTS paper_trades (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id         TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  token_symbol     TEXT NOT NULL,          -- e.g. "SOL", "JUP", "BONK"
  token_id         TEXT NOT NULL,          -- CoinGecko ID e.g. "solana"
  side             TEXT NOT NULL CHECK (side IN ('buy','sell')),
  amount_token     NUMERIC NOT NULL,       -- how many tokens
  amount_sol       NUMERIC NOT NULL,       -- SOL value at time of trade
  price_usd        NUMERIC NOT NULL,       -- USD price at entry
  price_sol        NUMERIC,               -- SOL price at entry
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','cancelled')),
  close_price_usd  NUMERIC,               -- USD price at close
  close_price_sol  NUMERIC,
  pnl_usd          NUMERIC,               -- profit/loss in USD
  pnl_pct          NUMERIC,               -- profit/loss percentage
  memo             TEXT,                  -- agent's reasoning
  opened_at        TIMESTAMPTZ DEFAULT NOW(),
  closed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_paper_trades_agent    ON paper_trades(agent_id);
CREATE INDEX IF NOT EXISTS idx_paper_trades_status   ON paper_trades(status);
CREATE INDEX IF NOT EXISTS idx_paper_trades_opened   ON paper_trades(opened_at DESC);

-- ── Migration: x402 payment ledger + replay protection ─────────────────────
CREATE TABLE IF NOT EXISTS x402_payments (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  operator_id                 UUID REFERENCES operators(id) ON DELETE SET NULL,
  endpoint                    TEXT NOT NULL,
  network                     TEXT NOT NULL,
  amount_atomic               NUMERIC NOT NULL,
  asset                       TEXT NOT NULL,
  pay_to                      TEXT NOT NULL,
  payer_address               TEXT NOT NULL,
  nonce                       TEXT NOT NULL UNIQUE,
  authorization_valid_after   TEXT NOT NULL,
  authorization_valid_before  TEXT NOT NULL,
  payment_signature           TEXT NOT NULL,
  facilitator_verified        BOOLEAN NOT NULL DEFAULT FALSE,
  facilitator_tx_hash         TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_x402_payments_operator   ON x402_payments(operator_id);
CREATE INDEX IF NOT EXISTS idx_x402_payments_created_at ON x402_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_x402_payments_network    ON x402_payments(network);

-- Server-only access: backend uses SUPABASE_SERVICE_KEY (bypasses RLS). Anon/auth clients get no access.
ALTER TABLE x402_payments ENABLE ROW LEVEL SECURITY;
