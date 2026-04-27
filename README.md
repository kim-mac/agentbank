# AgentBank / AgentStack

AgentBank is financial infrastructure for AI agents: wallet management, policy controls, and onchain monetization.

This repository contains:

- `agentbank-clean/backend` — Fastify API for operator/agent onboarding, claim flow, policies, and x402 endpoints
- `agentbank-dashboard` — Next.js dashboard for operators (agents, claims, policies, transactions, readiness)
- `agentbank-clean/sdk` — SDK and smoke scripts for agent onboarding + paid path validation
- `demoagent` — Telegram + NVIDIA conversational demo agent for skill-driven onboarding

---

## What This Project Does

AgentBank helps AI agents:

- self-onboard from a `skill.md` link
- create/register wallets with operator context
- complete human claim flow
- run under policy guardrails (limits, approvals, freeze/kill switch)
- access paid endpoints via Base-native x402 flow

It is designed to make agent finance safe and production-oriented, not just “agent can sign tx”.

---

## Core Capabilities

- **Skill-driven onboarding**
  - `GET /v1/skill.md`
  - `GET /v1/skill/:operatorKey.md`
- **Registration + claim lifecycle**
  - `POST /v1/register`
  - `GET /v1/register/status`
  - `GET /v1/register/capabilities`
  - `POST /v1/claim/:token`
- **Operator controls**
  - agent policy updates
  - freeze / unfreeze / pause
  - approvals queue and transaction visibility
- **x402 monetization + diagnostics**
  - paid premium route with deterministic 402 contracts
  - operator pricing + revenue + readiness views
- **Multi-chain support**
  - Base + Solana

---

## Repository Structure

```text
agentbank-v4/
  agentbank-clean/
    backend/                 # Fastify API + DB adapters + services
    sdk/                     # SDK + smoke scripts
    QUICKSTART_AI_AGENT.md   # canonical quickstart flow
  agentbank-dashboard/       # Next.js operator dashboard
  demoagent/                 # Telegram conversational demo runtime
  AgentStack_Architecture.md # architecture + submission context
  colosseum.md               # implementation/build log
```

---

## Local Development

### 1) Backend

From `agentbank-clean/backend`:

```bash
npm install
npm run dev
```

Default local API: `http://localhost:3001/v1`

### 2) Dashboard

From `agentbank-dashboard`:

```bash
npm install
npm run dev
```

Dashboard: `http://localhost:3000`

### 3) Demo Agent (optional)

From `demoagent`:

```bash
npm install
npm start
```

Use Telegram commands to test conversational skill onboarding and claim handoff.

---

## Quick Validation (SDK Smoke)

See canonical flow in `agentbank-clean/QUICKSTART_AI_AGENT.md`.

From `agentbank-clean/sdk`:

```bash
npm install
npm run smoke:onboarding:strict
npm run smoke:x402:negative
```

These validate onboarding readiness and deterministic x402 negative-path behavior.

---

## Demo Flow (Recommended)

1. Ask an agent runtime to read skill file:
   - local: `http://localhost:3001/v1/skill.md`
   - deployed: `https://agentbank-production-d681.up.railway.app/v1/skill.md`
2. Agent registers and returns claim link.
3. Human completes claim.
4. Agent checks status/capabilities and proceeds with payment-enabled actions.

---

## Deployment Notes

- API deploy target: Railway
- Dashboard deploy target: Vercel
- Ensure URL env vars are set correctly:
  - `DASHBOARD_URL`
  - `API_URL`
  - `SITE_URL`

Incorrect URL env values will cause wrong claim/personal skill links.

---

## Important Security Notes

- Never commit secrets (`.env`, private keys, operator keys).
- Keep operator/agent keys out of logs where possible.
- Use policy controls for production agents.

---

## Additional Docs

- `AgentStack_Architecture.md` — full architecture
- `colosseum.md` — implementation timeline and feature log
- `agentbank-clean/x402-contract.md` — x402 error/readiness contract
- `agentbank-clean/QUICKSTART_AI_AGENT.md` — submission quickstart

