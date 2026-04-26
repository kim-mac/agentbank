# AgentBank — Project Handoff v4
# Paste this at the start of a new chat to continue where we left off
# Last updated: March 2026

---

## What AgentBank Is

Non-custodial wallet infrastructure for AI agents. Agents hold their own private keys, AgentBank enforces spending policies and tracks transactions. The financial operating system for the agent economy.

**Core principle:** Agent generates its own keypair locally. Private key never leaves the agent's machine. AgentBank only stores public wallet address + policies + audit logs.

---

## Current Stack

```
Backend:    Node.js + TypeScript + Fastify — DEPLOYED on Railway
           https://agentbank-production-d681.up.railway.app
Database:   Supabase (live, persistent)
Blockchain: Solana devnet + Base Sepolia (full support)
AI:         Google Gemini (gemini-2.5-flash) via @google/genai
SDK:        TypeScript — agent imports, holds keys, signs txs
Frontend:   Next.js 14 — DEPLOYED on Vercel
           https://agentbank-teal.vercel.app
Price feed: CoinGecko free API (no key needed)
```

---

## How to Run

### Production (LIVE)
```
Frontend:   https://agentbank-teal.vercel.app
Backend:    https://agentbank-production-d681.up.railway.app
API:        https://agentbank-production-d681.up.railway.app/v1
```

### Local Development
```
Terminal 1: cd agentbank-clean/backend  && npm run dev  → localhost:3001
Terminal 2: cd agentbank-clean/sdk      && npm install  (once)
            cd agentbank-dashboard      && npm run dev  → localhost:3000
Terminal 3: cd agentbank-clean/demo-agent   && npm run auto  (research agent)
Terminal 4: cd agentbank-clean/demo-agent-2 && npm run auto  (news agent)
```

---

## Project Structure

```
agentbank-v4/
├── agentbank-clean/
│   ├── AGENT_WALLET.md
│   ├── skill.md                        ← agent onboarding skill file
│   ├── landing.html                    ← old static (no longer used)
│   ├── backend/
│   │   ├── .env                        ← Supabase keys + URL vars
│   │   ├── supabase-schema.sql
│   │   └── src/
│   │       ├── index.ts
│   │       ├── db.ts                   ← switcher
│   │       ├── db-memory.ts
│   │       ├── db-supabase.ts
│   │       ├── middleware/auth.ts
│   │       ├── routes/
│   │       │   ├── operator-routes.ts  ← includes DELETE, role, directory, feed, paper-mode
│   │       │   ├── agent-routes.ts     ← blocks unclaimed agents
│   │       │   ├── register-routes.ts  ← claim flow + dynamic skill files
│   │       │   ├── message-routes.ts   ← agent-to-agent messaging
│   │       │   └── paper-routes.ts     ← paper trading (NEW)
│   │       └── services/
│   │           ├── policy-engine.ts    ← 12 rules (7 basic + 5 advanced)
│   │           ├── solana.ts
│   │           ├── base.ts
│   │           ├── skill-builder.ts
│   │           └── price-feed.ts       ← CoinGecko integration (NEW)
│   ├── sdk/src/index.ts                ← AgentWallet (Solana + Base/viem) + messaging + group + paper trading
│   └── demo-agent/
│       ├── .env                        ← AGENTBANK_API_KEY + GEMINI_API_KEY
│       ├── src/
│       │   ├── setup.ts                ← one-time agent registration
│       │   ├── agent.ts                ← simple wallet test
│       │   ├── base-agent.ts           ← Gemini-powered base (all roles use this)
│       │   ├── auto-agent.ts           ← reads role from dashboard, runs automatically
│       │   └── roles/
│       │       ├── research-agent.ts
│       │       ├── news-agent.ts
│       │       ├── risk-agent.ts
│       │       ├── trading-agent.ts
│       │       └── execution-agent.ts
├── demo-agent-2/                       ← second agent (news role)
│   └── .env                            ← different AGENTBANK_API_KEY, same GEMINI_API_KEY
│
└── agentbank-dashboard/
    ├── app/
    │   ├── page.tsx                    ← landing page
    │   ├── feed/page.tsx               ← public live feed
    │   ├── dashboard/
    │   │   ├── page.tsx                ← operator overview
    │   │   ├── agents/page.tsx         ← agent management + delete + role button
    │   │   ├── approvals/page.tsx
    │   │   ├── transactions/page.tsx
    │   │   ├── messages/page.tsx       ← group channel + agent status
    │   │   └── paper/page.tsx          ← paper trading + live prices (NEW)
    │   └── claim/[token]/page.tsx
    ├── components/ui/
    │   ├── Navbar.tsx                  ← public pages nav
    │   ├── Sidebar.tsx                 ← dashboard sidebar (7 nav items)
    │   ├── Shell.tsx
    │   ├── ConnectScreen.tsx
    │   ├── PolicyBuilder.tsx           ← 5 advanced rules + messaging settings
    │   └── RoleEditor.tsx              ← role presets + group toggle + role document
    └── lib/
        ├── api.ts
        └── store.ts
```

---

## URL Structure

### Production
```
https://agentbank-teal.vercel.app/                         ← Landing page
https://agentbank-teal.vercel.app/feed                     ← Public live feed
https://agentbank-teal.vercel.app/leaderboard              ← Agent rankings
https://agentbank-teal.vercel.app/dashboard                ← Overview
https://agentbank-teal.vercel.app/dashboard/agents         ← Agent management
https://agentbank-teal.vercel.app/dashboard/approvals      ← Approval queue
https://agentbank-teal.vercel.app/dashboard/transactions   ← Transaction history
https://agentbank-teal.vercel.app/dashboard/messages       ← Agent group chat
https://agentbank-teal.vercel.app/dashboard/paper          ← Paper trading
https://agentbank-teal.vercel.app/claim/:token             ← Claim page

https://agentbank-production-d681.up.railway.app/v1/skill.md              ← Generic skill file
https://agentbank-production-d681.up.railway.app/v1/skill/:opKey.md       ← Personalized skill file
https://agentbank-production-d681.up.railway.app/v1/feed                  ← Public feed API
https://agentbank-production-d681.up.railway.app/v1/prices                ← Live prices (CoinGecko)
https://agentbank-production-d681.up.railway.app/v1/leaderboard           ← Leaderboard API
```

### Local Development
```
localhost:3000/                         ← Landing page
localhost:3000/feed                     ← Public live feed
localhost:3000/leaderboard              ← Agent rankings (NEW)
localhost:3000/dashboard                ← Overview
localhost:3000/dashboard/agents         ← Agent management
localhost:3000/dashboard/approvals      ← Approval queue
localhost:3000/dashboard/transactions   ← Transaction history
localhost:3000/dashboard/messages       ← Agent group chat
localhost:3000/dashboard/paper          ← Paper trading
localhost:3000/claim/:token             ← Claim page

localhost:3001/v1/skill.md              ← Generic skill file
localhost:3001/v1/skill/:opKey.md       ← Personalized skill file
localhost:3001/v1/feed                  ← Public feed API
localhost:3001/v1/prices                ← Live prices (CoinGecko)
localhost:3001/v1/leaderboard           ← Leaderboard API (NEW)
```

---

## backend/.env

```
# PRODUCTION (Railway)
USE_SUPABASE=true
SUPABASE_URL=https://tbuvuvmfujubqdourncg.supabase.co
SUPABASE_SERVICE_KEY=<real key>
NODE_ENV=production
DASHBOARD_URL=https://agentbank-teal.vercel.app
API_URL=https://agentbank-production-d681.up.railway.app/v1
SITE_URL=https://agentbank-production-d681.up.railway.app

# LOCAL DEVELOPMENT
USE_SUPABASE=true
SUPABASE_URL=https://tbuvuvmfujubqdourncg.supabase.co
SUPABASE_SERVICE_KEY=<real key>
PORT=3001
DASHBOARD_URL=http://localhost:3000
API_URL=http://localhost:3001/v1
SITE_URL=http://localhost:3001/v1

# BASE CHAIN (both environments)
BASE_RPC_URL=https://sepolia.base.org
BASE_NETWORK=sepolia
```

---

## demo-agent/.env

```
AGENTBANK_URL=http://localhost:3001/v1
AGENTBANK_API_KEY=agent_0e98956cc00547e59a4a37be7713a14d  ← research agent
OPERATOR_API_KEY=op_b1d45b0a24a044499fca3361a9c20d24
AGENT_KEY_PATH=C:\...\demo-agent\.agent-key
GEMINI_API_KEY=AIzaSy_your_key
```

## demo-agent-2/.env

```
AGENTBANK_URL=http://localhost:3001/v1
AGENTBANK_API_KEY=agent_14be0a7134e14eb28025d2cdc82d6701  ← news agent
OPERATOR_API_KEY=op_b1d45b0a24a044499fca3361a9c20d24
AGENT_KEY_PATH=C:\...\demo-agent-2\.agent-key
GEMINI_API_KEY=AIzaSy_your_key
```

## Supabase Agent IDs

```
demo-agent-01:  86f4ac37-c9a2-438d-a7bc-859ebb1809fa  (role: research, inGroup: true)
demo-agent-2:   d316c655-80dc-4ce1-84ab-586f4556bc95  (role: news, inGroup: true)
operator:       op_b1d45b0a24a044499fca3361a9c20d24
```

---

## All API Endpoints

### Public (no auth)
```
GET  /v1/skill.md
GET  /v1/skill/:operatorKey.md
GET  /v1/feed
GET  /v1/prices?symbols=SOL,BTC,ETH
GET  /health
```

### Registration + Claim
```
POST /v1/register                       ← email OR operatorKey
GET  /v1/register/status
GET  /v1/claim/:token
POST /v1/claim/:token
GET  /v1/operators/pending-claims
```

### Operator (x-api-key header)
```
POST /v1/operators/register
POST /v1/operators/agents
GET  /v1/operators/agents
PATCH /v1/operators/agents/:id/policy
PATCH /v1/operators/agents/:id/role
POST /v1/operators/agents/:id/freeze
POST /v1/operators/agents/:id/paper-mode  ← NEW
DELETE /v1/operators/agents/:id
GET  /v1/operators/agents/directory
GET  /v1/operators/approvals
POST /v1/operators/approvals/:id
GET  /v1/operators/transactions
GET  /v1/operators/messages
POST /v1/operators/messages/send
GET  /v1/operators/messages/group
GET  /v1/operators/paper/trades           ← NEW
```

### Agent (Authorization: Bearer)
```
GET  /v1/agent/wallet
POST /v1/agent/wallet/check
POST /v1/agent/wallet/request
POST /v1/agent/wallet/confirm
GET  /v1/agent/wallet/tx/:id
GET  /v1/agent/wallet/history
GET  /v1/agent/policy
POST /v1/agent/messages/send
GET  /v1/agent/messages
GET  /v1/agent/messages/unread
POST /v1/agent/messages/:id/read
POST /v1/agent/messages/:id/act
GET  /v1/agent/messages/channel/:id
GET  /v1/agent/group/directory
POST /v1/agent/paper/trade                ← NEW
POST /v1/agent/paper/trade/:id/close      ← NEW
GET  /v1/agent/paper/portfolio            ← NEW
GET  /v1/agent/paper/price/:symbol        ← NEW
```

---

## Policy Engine (12 rules)

### Basic
1. Kill switch
2. Agent status (active/paused/frozen)
3. Chain whitelist
4. Per-transaction limit
5. Daily spend limit
6. Address whitelist

### Advanced
7. Time-based rules (UTC hours + block weekends)
8. Balance threshold (auto-pause when low)
9. Spend threshold (approval above X% of daily limit)
10. Per-address limits (max SOL/day + max tx/hour)
11. Category rules (DEX, prediction market, API + block unknown)
12. Approval threshold → PENDING_APPROVAL

### Messaging policy (stored in policy.messagingRule)
- allowMessages: bool
- canActOnMessages: bool
- trustedSenders: string[]

---

## Supabase Schema (current)

```sql
operators:    id, email, org_name, api_key, created_at
agents:       id, operator_id, name, description, api_key, wallet_address, chain,
              status, claim_status, claim_token, claimed_at,
              role_name, role_document, in_group,
              paper_mode, paper_balance, paper_balance_usd,
              policy_daily_limit, policy_tx_limit, policy_require_approval_above,
              policy_whitelisted_addresses, policy_allowed_chains, policy_kill_switch,
              policy_time_rule (JSONB), policy_balance_rule (JSONB),
              policy_spend_threshold (JSONB), policy_per_address_rule (JSONB),
              policy_category_rule (JSONB),
              policy_allow_messages, policy_can_act_on_messages, policy_trusted_senders,
              created_at
transactions: id, agent_id, chain, from_address, to_address, amount, token,
              status, reject_reason, tx_hash, memo, created_at, confirmed_at
approval_requests: id, transaction_id, agent_id, operator_id, status,
                   created_at, responded_at
messages:     id, sender_agent_id, receiver_agent_id, channel_id, channel_type,
              content, message_type, acted_on, triggered_tx_id,
              created_at, read_at
paper_trades: id, agent_id, token_symbol, token_id, side, amount_token, amount_sol,
              price_usd, price_sol, status, close_price_usd, close_price_sol,
              pnl_usd, pnl_pct, memo, opened_at, closed_at

-- Soft delete: agents with api_key LIKE 'deleted_%' are filtered out
```

---

## Multi-Agent Collaboration System

### How it works
```
Operator assigns roles to agents via dashboard (Agents → Role button)
Each agent gets: roleName + roleDocument + inGroup toggle
Agents in group share ONE private channel (channelId = operatorId)

Agent startup (npm run auto):
  → reads role from AgentBank via wallet.groupDirectory()
  → role document becomes the AI system prompt
  → joins group loop, polls every 20s
  → responds to messages based on role
  → posts insights autonomously

Group channel ID = operator ID (op_b1d45b0a...)
```

### Current agents
```
demo-agent-01: research role — analyzes data, posts [ANALYSIS] tags
demo-agent-2:  news role — generates market news, posts [NEWS] tags
```

### SDK group methods
```typescript
wallet.groupDirectory()                     // who are my teammates + my role
wallet.postToGroup(channelId, msg, type)    // post to group channel
wallet.channelMessages(channelId)           // read channel history
wallet.startGroupLoop({ onMessage })        // start autonomous loop
wallet.sendMessage({ toAgentId, content })  // DM another agent
wallet.actOnMessage(msgId, { to, amount })  // execute tx from message
```

---

## Paper Trading System (NEW)

### How it works
```
Operator enables paper mode on agent (dashboard → Paper Trading)
Agent gets 100 virtual SOL balance
Agent calls wallet.paperTrade() instead of wallet.send()
Real market prices from CoinGecko (no API key needed)
P&L tracked in paper_trades table
Policy engine still runs (limits enforced even on paper)
```

### Supported tokens
```
SOL, BTC, ETH, USDC, JUP, BONK, WIF, PYTH, RAY, ORCA, DRIFT, JITO, MSOL, USDT
```

### SDK paper trading methods
```typescript
wallet.paperTrade({ tokenSymbol, side, amountSol, memo })
wallet.closePaperTrade(tradeId)
wallet.paperPortfolio()     // open positions + P&L + stats
wallet.tokenPrice("SOL")    // current price from CoinGecko
```

---

## Key File Naming

```
Format:  agent_{name}_{random6}.key
Example: agent_trading-bot_a3f9k2.key

SDK usage:
  new AgentWallet({ agentApiKey, agentName: "trading-bot" })
  → auto-finds agent_trading-bot_*.key or creates new one
```

---

## Design System

### Fonts
```
Instrument Serif — display headings (page-title class)
DM Sans          — body, UI
DM Mono          — addresses, amounts, code (mono class / var(--mono))
```

### Colors (dark mode default, html.light for light mode)
```css
--bg:       #080809    --surface:  #0f0f11    --surface2: #161618
--text:     #e8e7e2    --muted:    #6b6a65    --muted2:   #4a4945
--accent:   #c8f060    --accent2:  rgba(200,240,96,0.1)
--green:    #4ade80    --red:      #f87171
--amber:    #fbbf24    --indigo:   #818cf8
--border:   rgba(255,255,255,0.07)
--border2:  rgba(255,255,255,0.13)
```

### Light mode (html.light class)
```css
--bg: #f4f3ef  --surface: #ffffff  --accent: #5a7a10
```

### Principles
- Noise texture overlay on body
- Instrument Serif for all page titles (class: page-title)
- Lime accent (#c8f060) only for primary CTAs
- Cards: var(--surface), 1px border, 14px radius
- Modals: createPortal to document.body (fixes stacking context)
- Navbar for public pages, Sidebar for dashboard pages
- Shell centers content at maxWidth 1120px
- Only auto-scroll to bottom if already at bottom (messages page)

---

## What's Built ✅

```
Core
  Non-custodial wallet (Solana + Base)
  Policy engine (12 rules: 7 basic + 5 advanced, chain-aware balance rule)
  Claim flow + skill files (generic + personalized)
  Auto operator creation from email
  Soft delete agents

Multi-agent
  Agent roles + role documents (6 presets + custom)
  Group collaboration (private operator channel)
  Gemini-powered autonomous agents (auto-agent.ts)
  Agent-to-agent messaging (DM + group)
  Act on messages (execution agent)
  Agent directory endpoint

Dashboard (Next.js)
  Landing page → Feed → Dashboard (connected nav)
  Public live feed (auto-refresh)
  Public leaderboard (ranks by P&L, return %, win rate) — NEW
  Overview with pending claims + Add Agent card
  Agents page with Role + Policy + Delete (fixed alignment)
  Advanced Policy Builder (5 rule types + messaging)
  Role Editor (6 presets, group toggle, role document) — BUG FIXED
  Messages page (group channel, DM tab working) — BUG FIXED
  Paper Trading page (live prices + portfolio)
  Dark/light mode toggle

Paper Trading
  Virtual balance per agent (100 SOL default)
  CoinGecko price feed (14 tokens, no API key)
  P&L tracking (realized + unrealized)
  Live price ticker in dashboard
  Policy engine enforces limits on paper trades

SDK
  Full wallet methods (Solana + Base)
  EVM key generation + signing via viem
  Chain-aware constructor (chain: "solana" | "base")
  Messaging methods (send, receive, act)
  Group loop (autonomous agent collaboration)
  Paper trading methods
  generateKeyPath (unique key files, .key for Solana, .base.key for Base)

🚀 DEPLOYMENT (NEW)
  Backend deployed on Railway
  Frontend deployed on Vercel
  Production URLs configured and tested
  All features working in production
  Login/authentication working
  Database connected to Supabase
```

---

## Roadmap

### Completed ✅
1. **Leaderboard** — rank agents by paper trading performance
   - Public page at /leaderboard with time filters
   - Rank by: return %, win rate, P&L
   - Agent profiles with stats
   - API endpoint for external agents

2. **Bug Fixes**
   - Role Editor UI now saves correctly from dashboard
   - Agent card buttons properly aligned
   - Messages page group channel filter fixed
   - All tabs displaying correctly

3. **Deployment to Railway + Vercel** ✅
   - Backend deployed and running on Railway
   - Frontend deployed and running on Vercel
   - Database connected to Supabase
   - All features tested and working in production
   - Operator dashboard login working

4. **Base chain full support** ✅
   - SDK: viem-based EVM key generation, signing, and broadcasting
   - Backend: chain-aware balance (policy engine Rule 8), address validation, explorer URLs
   - Dashboard: chain selector on agent creation, allowedChains in PolicyBuilder
   - Dashboard: chain column in transactions, correct explorer links per chain
   - Balance API: unified `{ native, unit }` shape (no more `{ sol: eth }` hack)

### Next up
1. **Prediction markets** — agents bet on outcomes
   - Paper predict first (YES/NO with virtual money)
   - Track accuracy over time (win rate = agent intelligence metric)
   - Real money via Drift Protocol on Solana
   - Integrates with leaderboard

2. **Smart contracts (Phase 3)**
   - Squads Protocol on Solana
   - Policies enforced on-chain

3. **npm publish @agentbank/sdk**

---

## Known Issues / Workarounds

### ✅ RESOLVED

**Role Editor not saving from dashboard button** — FIXED
- Backend now returns roleName and roleDocument fields properly
- Dashboard button saves correctly

**Agent cards alignment** — FIXED
- Delete button no longer overflows card border
- Buttons properly organized in two rows

**Messages page group filter** — FIXED
- Group channel messages now display correctly
- Filter expanded to catch all channel type variations

### Remaining Issues

**Gemini model**
Use `gemini-2.5-flash` (current free tier model as of March 2026)
Package: `@google/genai` (NOT the old `@google/generative-ai`)

**Setup.ts fails for second agent**
**Workaround:** Use `/v1/register` directly with existing operatorKey:
```powershell
Invoke-RestMethod -Method POST `
  -Uri "https://agentbank-production-d681.up.railway.app/v1/register" `
  -ContentType "application/json" `
  -Body '{"operatorKey": "op_xxx", "walletAddress": "NEW_WALLET", "name": "agent-name"}'
```

---

## Key Decisions Made (don't revisit)

1. Non-custodial — agent holds own keys, backend never sees private key
2. No private key sharing with owner — owner controls via kill switch/freeze/approval
3. Soft delete agents — api_key prefixed with 'deleted_', filtered from queries
4. SITE_URL points to backend for skill file serving
5. Solana + Base both fully supported (native transfers; ERC-20 deferred)
6. Portal pattern for all modals (createPortal)
7. html.light class for light mode
8. Unique key files: agent_name_random.key format
9. Group channel ID = operator ID
10. Paper trading uses CoinGecko free tier (no API key)

---

## How to Continue in New Chat

Paste this document then say:
"I'm building AgentBank. Read the handoff carefully and continue.

Current Status: ✅ DEPLOYED AND LIVE
- Frontend: https://agentbank-teal.vercel.app
- Backend: https://agentbank-production-d681.up.railway.app
- All core features working in production

Next: [choose one below]

Options:
A) Build prediction markets (agents bet on outcomes)
B) Implement smart contracts (Squads Protocol)
C) Publish @agentbank/sdk to npm
D) Continue from where we left off"
