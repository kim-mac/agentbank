# AGENT_WALLET.md — AgentBank Wallet Skill

Read this file once at startup. It tells you everything you need to set up and operate your wallet autonomously.

---

## What AgentBank Is

AgentBank gives you a non-custodial wallet (Solana or Base) with programmable spending policies. Your private key lives only on your machine — AgentBank never sees it. You sign and broadcast transactions yourself. AgentBank checks whether each transaction is within your policy limits and tracks your spending for your human operator.

---

## First Run — Register Yourself

If you don't have an `AGENTBANK_API_KEY` yet, register now:

```bash
curl -X POST https://api.agentbank.xyz/v1/register \
  -H "Content-Type: application/json" \
  -d '{
    "operatorKey":   "op_xxxx",
    "walletAddress": "YOUR_PUBLIC_ADDRESS",
    "name":          "your-agent-name",
    "description":   "What you do",
    "chain":         "solana"
  }'
```

Set `"chain"` to `"solana"` (default) or `"base"` depending on your wallet type. The `operatorKey` is given to you by your human. If you do not have one, ask them to sign up at agentbank.xyz.

**Save the response immediately:**
```json
{
  "agentApiKey":  "agent_xxxx",
  "claimUrl":     "https://app.agentbank.xyz/claim/TOKEN",
  "claimStatus":  "pending"
}
```

- Save `agentApiKey` to your environment as `AGENTBANK_API_KEY`
- Send `claimUrl` to your human — they must click it to activate you
- You cannot transact until your human claims you

**Check if you have been claimed:**
```bash
curl https://api.agentbank.xyz/v1/register/status \
  -H "Authorization: Bearer YOUR_AGENT_API_KEY"
```

Poll this every 30 seconds until `claimStatus` is `"claimed"`.

---

## Setup (After Registration)

```typescript
import { AgentWallet } from "@agentbank/sdk";

// Solana agent (default)
const wallet = new AgentWallet({
  agentApiKey: process.env.AGENTBANK_API_KEY,
  agentName:   "my-agent",
  chain:       "solana",
});

// Base agent (Ethereum L2)
const wallet = new AgentWallet({
  agentApiKey: process.env.AGENTBANK_API_KEY,
  agentName:   "my-agent",
  chain:       "base",
});
// Key files: .key for Solana, .base.key for Base — never share either
```

---

## Core Actions

### Check wallet on startup (always do this first)

```typescript
const info = await wallet.info();
if (info.status !== "active") process.exit(0);
if (info.claimStatus === "pending") {
  console.log("Waiting for human to claim me...");
  process.exit(0);
}
```

### Dry-run before every send

```typescript
const check = await wallet.canSend({ to: "...", amount: 0.1 });
if (!check.allowed) {
  console.log(check.reason);
  return; // do not retry
}
```

### Send a transaction

```typescript
const result = await wallet.send({
  to:     "recipient-address",
  amount: 0.05,
  memo:   "Paying for market data API — task #42", // required
  // token defaults to SOL (Solana) or ETH (Base) based on your chain
});

if (result.status === "confirmed") {
  console.log(result.txHash);
}
if (result.status === "pending_approval") {
  const final = await wallet.waitForApprovalAndSend(result.transactionId);
}
if (result.status === "rejected") {
  console.log(result.reason); // do not retry
}
```

---

## Rules You Must Follow

**Rule 1 — Always include a memo**
Every `send()` must have a meaningful memo. Your operator reads these.
- ✅ `"Placing prediction market bet: SOL > $200 by Friday"`
- ❌ `""` or `"payment"`

**Rule 2 — Always dry-run first**
Call `canSend()` before `send()`. Never attempt a transaction you know will fail.

**Rule 3 — Never retry a rejected transaction**
If rejected, adapt your approach. Do not send the same transaction again.

**Rule 4 — Never expose your private key**
The key is in `.agent-key`. Never log it, send it to any API, or include it in error messages.

**Rule 5 — Wait for approval on large transactions**
Transactions above your approval threshold need operator sign-off. Use `waitForApprovalAndSend()`.

**Rule 6 — You cannot transact until claimed**
If `claimStatus` is `"pending"`, do not attempt transactions. Tell your human to open the claim URL.

---

## Understanding Your Policy Limits

```typescript
const policy = await wallet.policy();
```

| Field | Meaning |
|-------|---------|
| `dailyLimit` | Max native tokens (SOL or ETH) per day |
| `dailyRemaining` | How much is left today |
| `txLimit` | Max per single transaction |
| `requireApprovalAbove` | Needs human sign-off above this |
| `whitelistedAddresses` | Allowed destinations (empty = all) |
| `allowedChains` | Which chains you can transact on |
| `killSwitch` | If true, all transactions blocked |
| `agentStatus` | `active` / `paused` / `frozen` |
| `claimStatus` | `pending` (not yet activated) / `claimed` (active) |

---

## Quick Reference

```typescript
wallet.walletAddress                     // your public address (Solana or 0x Base)
wallet.chain                             // "solana" or "base"
wallet.info()                            // balance, policy, status, claimStatus
wallet.balance()                         // { native, unit } — e.g. { native: 1.5, unit: "SOL" }
wallet.policy()                          // current spending limits
wallet.canSend({ to, amount })           // dry-run check
wallet.send({ to, amount, memo })        // full send flow (token defaults to SOL or ETH)
wallet.waitForApprovalAndSend(txId)      // wait for human approval
wallet.txStatus(txId)                    // check one transaction
wallet.history()                         // recent transactions
wallet.requestAirdrop()                  // devnet SOL only (Base: use faucet)
```

---

## What AgentBank Sees vs What It Doesn't

| Data | AgentBank sees it? |
|------|-------------------|
| Your public wallet address | ✅ Yes |
| Your private key | ❌ Never |
| Transaction amounts | ✅ Yes — policy enforcement |
| Transaction memo | ✅ Yes — audit trail |
| Who you send to | ✅ Yes — whitelist check |
| Your signing process | ❌ Never |

---

*Hosted at: https://agentbank.xyz/AGENT_WALLET.md*
*Your operator can update your policy limits anytime from the dashboard.*
*Re-fetch this file periodically to see new features.*
