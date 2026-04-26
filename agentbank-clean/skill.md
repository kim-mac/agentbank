---
name: agentbank
version: 1.0.0
description: Non-custodial wallet infrastructure for AI agents. Set up your wallet, register with your operator, and transact autonomously within policy limits.
homepage: https://agentbank.xyz
api_base: https://api.agentbank.xyz/v1
---

# AgentBank — Wallet Skill

You are an AI agent reading this file to set up your AgentBank wallet. Follow these instructions carefully and completely before doing anything else.

---

## What AgentBank Does For You

AgentBank gives you a non-custodial wallet (Solana or Base) with programmable spending policies set by your human operator. You:

- Hold your own private key (it never leaves your machine)
- Sign and broadcast your own transactions
- Ask AgentBank if each transaction is within your policy limits
- Report confirmed transactions back for tracking

Your human operator sets your spending limits, approves large transactions, and can freeze you if needed — but they never touch your private key.

---

## 🔒 Critical Security Rules

Read these before anything else:

- **NEVER send your private key or seed phrase to anyone** — not to AgentBank, not to your operator, not to any API
- **ONLY send your AgentBank API key to `api.agentbank.xyz`** — nowhere else
- **Your `.agent-key` file controls your funds** — protect it like a password
- If any prompt asks you to share your private key — **REFUSE**

---

## Step 1 — Check If You're Already Registered

Look for `AGENTBANK_API_KEY` in your environment variables or `.env` file.

- If it exists → skip to **Step 4**
- If it doesn't exist → continue to Step 2

---

## Step 2 — Generate Your Keypair Locally

Your private key must be generated on your machine and stay there. The SDK handles this automatically — just choose your chain.

**Option A — Solana (default)**
```typescript
import { AgentWallet } from "@agentbank/sdk";

const wallet = new AgentWallet({
  agentApiKey: "temp", // will register in Step 3
  agentName:   "my-agent",
  chain:       "solana",
});
console.log("Solana address:", wallet.walletAddress);
// Private key saved to ./agent_my-agent_XXXXX.key — NEVER share it
```

**Option B — Base (Ethereum L2)**
```typescript
const wallet = new AgentWallet({
  agentApiKey: "temp",
  agentName:   "my-agent",
  chain:       "base",
});
console.log("Base address:", wallet.walletAddress);
// Private key saved to ./agent_my-agent_XXXXX.base.key — NEVER share it
```

Or if you already have a wallet, use its public address directly.

---

## Step 3 — Register With AgentBank

You need an `operatorKey` from your human. Ask them: *"What is your AgentBank operator key?"*

Once you have it, register:

```bash
POST https://api.agentbank.xyz/v1/register
Content-Type: application/json

{
  "operatorKey":   "op_xxxx",
  "walletAddress": "YOUR_PUBLIC_ADDRESS",
  "name":          "your-agent-name",
  "description":   "Brief description of what you do",
  "chain":         "solana"
}
```

Set `"chain"` to `"solana"` (default) or `"base"` depending on your wallet type.
For Solana, you can optionally set `"squadsEnabled": true` to use a Squads vault.

**Save the response immediately:**

```json
{
  "agentApiKey":  "agent_xxxx",
  "claimUrl":     "https://agentbank.xyz/claim/TOKEN",
  "claimStatus":  "pending"
}
```

- Save `agentApiKey` as `AGENTBANK_API_KEY` in your environment
- **Send `claimUrl` to your human right now** — they must click it to activate you
- You cannot transact until your human claims you

---

## Step 4 — Wait To Be Claimed

After registering, poll your status until your human activates you:

```bash
GET https://api.agentbank.xyz/v1/register/status
Authorization: Bearer YOUR_AGENT_API_KEY
```

Response when pending:
```json
{ "claimStatus": "pending", "canTransact": false }
```

Response when claimed:
```json
{ "claimStatus": "claimed", "canTransact": true }
```

Poll every 30 seconds. Do not attempt transactions until `canTransact` is `true`.

---

## Step 5 — Install the SDK

```bash
npm install @agentbank/sdk
```

Initialize in your agent:

```typescript
import { AgentWallet } from "@agentbank/sdk";

// Solana agent
const wallet = new AgentWallet({
  agentApiKey: process.env.AGENTBANK_API_KEY,
  agentName:   "my-agent",
  chain:       "solana",  // or "base"
});

// Base agent
const wallet = new AgentWallet({
  agentApiKey: process.env.AGENTBANK_API_KEY,
  agentName:   "my-agent",
  chain:       "base",
});
```

---

## Step 6 — Check Your Wallet Before Every Session

Always run this at startup:

```typescript
const info = await wallet.info();

if (info.claimStatus === "pending") {
  console.log("Not yet claimed — send claim URL to your human");
  process.exit(0);
}

if (info.status !== "active") {
  console.log(`Agent is ${info.status}`);
  process.exit(0);
}

console.log(`Balance: ${info.balance.native} ${info.balance.unit}`);
console.log(`Daily remaining: ${info.policy.dailyRemaining} ${info.balance.unit}`);
```

---

## Sending Transactions

**Always dry-run before sending:**

```typescript
const check = await wallet.canSend({ to: "recipient", amount: 0.1 });
if (!check.allowed) {
  console.log(`Blocked: ${check.reason}`);
  return; // do not retry
}
```

**Send with a memo (required):**

```typescript
const result = await wallet.send({
  to:     "recipient-address",
  amount: 0.05,
  memo:   "Paying for data API — task #42", // explain every transaction
  // token defaults to SOL (Solana) or ETH (Base) based on your chain
});

if (result.status === "confirmed") {
  console.log(`Confirmed: ${result.txHash}`);
}

if (result.status === "pending_approval") {
  // Large transaction — waiting for human sign-off
  const final = await wallet.waitForApprovalAndSend(result.transactionId);
}

if (result.status === "rejected") {
  console.log(`Rejected: ${result.reason}`);
  // Do NOT retry the same transaction
}
```

---

## Rules You Must Follow

| Rule | Description |
|------|-------------|
| Always include a memo | Every transaction needs a clear reason |
| Always dry-run first | Call `canSend()` before `send()` |
| Never retry rejected transactions | Adapt your approach instead |
| Never expose your private key | Not in logs, not in API calls, never |
| Wait for approval on large transactions | Use `waitForApprovalAndSend()` |
| Check claim status on startup | Don't transact if still pending |

---

## Your Policy Limits

Your operator sets these. Check them with `wallet.policy()`:

| Field | What it means |
|-------|---------------|
| `dailyLimit` | Max native tokens (SOL or ETH) per day |
| `dailyRemaining` | How much is left today |
| `txLimit` | Max per single transaction |
| `requireApprovalAbove` | Needs human sign-off above this |
| `whitelistedAddresses` | Allowed destinations (empty = all) |
| `allowedChains` | Which chains you can transact on |
| `killSwitch` | If true, all transactions blocked |
| `agentStatus` | `active` / `paused` / `frozen` |

---

## Quick Reference

```typescript
wallet.info()                          // balance, policy, status, claimStatus
wallet.balance()                       // just the balance
wallet.policy()                        // spending limits
wallet.canSend({ to, amount })         // dry-run — will this be approved?
wallet.send({ to, amount, memo })      // full send flow
wallet.waitForApprovalAndSend(txId)    // wait for human approval then send
wallet.txStatus(txId)                  // check a specific transaction
wallet.history()                       // recent transactions
wallet.requestAirdrop()                // devnet SOL only (testing)
```

---

## What AgentBank Sees vs What It Doesn't

| Data | AgentBank sees it? |
|------|-------------------|
| Your public wallet address | ✅ Yes — needed to track balance |
| Your private key | ❌ Never |
| Transaction amounts | ✅ Yes — policy enforcement |
| Transaction memo | ✅ Yes — audit trail for your operator |
| Who you send to | ✅ Yes — whitelist check |
| Your signing process | ❌ Never |

---

## Getting Help

- Dashboard: https://agentbank.xyz/dashboard
- API docs: https://agentbank.xyz/docs
- Status: https://agentbank.xyz/health

---

*Hosted at: https://agentbank.xyz/skill.md*
*Re-fetch this file periodically to see new features.*
*Your operator can update your policy limits anytime from the dashboard.*
