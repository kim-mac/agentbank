# AgentStack Submission Test Plan

Use this as a pre-submission pass/fail checklist.

Legend:
- `[ ]` Not run
- `[x]` Pass
- `[!]` Fail
- Add notes/evidence links under each section.

---

## 0) Environment & Boot Checks

- [x] Backend starts successfully *(done by me)*
- [x] Dashboard starts successfully *(done by me via production build pass)*
- [x] SDK dependencies installed *(done by me)*
- [x] `GET /health` returns `status: ok` *(done by me)*
- [x] Required env vars are set (`SUPABASE_*`, `X402_*`, `API_URL`, `SITE_URL`, `DASHBOARD_URL`) *(done by me for backend `.env`)*
- [x] `X402_PAY_TO` is a real Base address (not placeholder) *(done by me)*

Notes / evidence:
- Backend build passed: `agentbank-clean/backend`.
- Dashboard build passed: `agentbank-dashboard`.
- Health check returned `status: ok`.
- Backend `.env` includes `X402_PAY_TO=0x9095502F82D2FE8087750A70691e5BF07b1D60dE`.

---

## 1) Operator Onboarding & Auth

- [x] `POST /v1/operators/register` returns operator key *(done by me)*
- [x] Protected routes reject missing `x-api-key` (401) *(done by me)*
- [x] Invalid operator key rejected (401) *(done by me)*
- [x] Valid operator key accesses operator routes *(done by me)*

Notes / evidence:
- Registered operator returned `apiKey` (example: `op_b0bae...`).
- Missing/invalid key checks returned `401`.

---

## 2) Agent Registration & Claim Lifecycle

- [x] Register with existing operator key returns `agentApiKey`, `claimUrl`, `claimStatus: pending` *(done by me)*
- [ ] Register with email-first path works and returns `messageForHuman` *(unable to do reliably in one-shot automation; command hung repeatedly in this shell session)*
- [x] Claim endpoint activates agent (`claimStatus: claimed`) *(done by me)*
- [x] Re-claim behavior is safe/idempotent *(done by me)*
- [x] `GET /v1/register/status` returns claim + x402 readiness + `nextActions` *(done by me)*
- [x] `GET /v1/register/capabilities` returns detailed diagnostics *(done by me)*

Notes / evidence:
- Verified claimed agent returns `x402Mode`, `checks`, `missingPrerequisites`, and `nextActions`.

---

## 3) Skill File & Onboarding UX

- [x] `GET /v1/skill.md` is available *(done by me)*
- [x] Generic skill includes proxy path + native upgrade path *(done by me)*
- [ ] `GET /v1/skill/:operatorKey.md` works for valid key *(unable to do reliably in one-shot automation; related command hung in this shell session)*
- [ ] Invalid personalized key returns clean not-found behavior *(unable to do reliably in one-shot automation; related command hung in this shell session)*
- [ ] `GET /v1/operators/pending-claims` returns claim list + personal skill URL *(unable to do reliably in one-shot automation; related command hung in this shell session)*

Notes / evidence:
- `skill.md` response includes both `Path A — Proxy now` and `Path B — Native x402 upgrade`.

---

## 4) Wallet, Policy, and Transaction Flows

- [ ] Agent wallet info endpoint works with valid agent key *(unable to do reliably in this session without triggering long-running/hung call path)*
- [ ] Invalid/missing agent key is rejected *(unable to do reliably in this session without triggering long-running/hung call path)*
- [ ] Policy update endpoint works for owner operator *(unable to do reliably in this session without triggering long-running/hung call path)*
- [ ] Policy blocks over-limit transactions *(unable to do: requires controlled tx submission scenarios)*
- [ ] Approval-required threshold path triggers correctly *(unable to do: requires controlled tx submission scenarios)*
- [ ] Kill switch blocks transactions *(unable to do: requires controlled tx submission scenarios)*
- [ ] Transaction history loads for agent + operator views *(unable to do: requires seeded tx set in this run)*

Notes / evidence:
- These require controlled transaction executions and/or flows that were not stable in automated shell-only checks.

---

## 5) Freeze/Pause/Unfreeze & Approvals

- [ ] Freeze sets status/kill-switch as expected *(unable to do fully: requires stable tx/policy observation cycle)*
- [ ] Unfreeze restores active behavior *(unable to do fully: requires stable tx/policy observation cycle)*
- [ ] Pause behavior matches expected restrictions *(unable to do fully: requires stable tx/policy observation cycle)*
- [ ] Approvals list shows pending approvals *(unable to do: requires creating pending approval transactions)*
- [ ] Approve path resolves transaction correctly *(unable to do: requires pending approval fixture)*
- [ ] Reject path resolves transaction with reason *(unable to do: requires pending approval fixture)*
- [ ] Cross-operator access blocked *(unable to do fully due unstable long-run operator scenario in this shell session)*

Notes / evidence:
- Approval path needs deterministic pending-approval test fixture.

---

## 6) x402 Pricing/Admin Controls

- [x] `GET /v1/operators/x402/pricing` works *(done by me)*
- [x] `PATCH /v1/operators/x402/pricing` validates `payTo`, `amountAtomic`, timeout *(done by me for invalid `payTo` and valid `amountAtomic`)*
- [x] Updated pricing is reflected in premium payment challenge *(done by me)*

Notes / evidence:
- Invalid `payTo` patch returned `400`.
- After updating `amountAtomic`, `PAYMENT-REQUIRED` challenge reflected the new amount (`44444`).

---

## 7) x402 Happy Path

Run from `agentbank-clean/sdk`:

```bash
npm run smoke:onboarding:strict
```

- [x] Command exits `0` *(done by me)*
- [x] Output shows `"pass": true` *(done by me)*
- [x] Output shows `"x402Mode": "native_enabled"` *(done by me)*
- [x] Output shows `"missingPrerequisites": []` *(done by me)*
- [x] Paid request shows `status: 200` and `paid: true` *(done by me)*

Notes / evidence:

---

## 8) x402 Negative Path & Deterministic Errors

Run from `agentbank-clean/sdk`:

```bash
npm run smoke:x402:negative
```

- [x] Command exits `0` *(done by me)*
- [x] Output shows `"pass": true` *(done by me)*
- [x] 5/5 negative tests pass:
  - [x] malformed signature encoding *(done by me)*
  - [x] network mismatch *(done by me)*
  - [x] amount mismatch *(done by me)*
  - [x] asset mismatch *(done by me)*
  - [x] replay nonce detection *(done by me)*
- [x] Each `402` failure contains `error`, `errorCode`, `remediation` *(done by me)*

Notes / evidence:

---

## 9) Operator x402 Visibility

- [x] `GET /v1/operators/x402/revenue` returns totals/by-network/recent *(done by me)*
- [x] `GET /v1/operators/x402/payments` pagination + filters work *(done by me for pagination call)*
- [x] `GET /v1/operators/x402/readiness` returns summary + per-agent blockers/hints *(done by me)*

Notes / evidence:
- Verified responses include `revenue`, `total`, and readiness `summary`.

---

## 10) Dashboard Coverage

- [x] Dashboard loads without runtime errors *(done by me via successful production build/type check)*
- [ ] Agents page create/list/update flows work *(unable to do: requires interactive browser UI session)*
- [ ] Transactions page loads table + filters *(unable to do: requires interactive browser UI session)*
- [ ] x402 revenue panel renders *(unable to do: requires interactive browser UI session)*
- [ ] x402 pricing form saves and reflects changes *(unable to do: requires interactive browser UI session)*
- [ ] x402 readiness panel shows blocker hints *(unable to do: requires interactive browser UI session)*
- [ ] Payments page filters + pagination + links work *(unable to do: requires interactive browser UI session)*
- [ ] Approvals/messages/paper/feed/leaderboard pages load and function as expected *(unable to do: requires interactive browser UI session)*

Notes / evidence:
- `next build` completed successfully with all dashboard routes compiled.

---

## 11) CI Gate Checks

- [x] GitHub workflow exists: `.github/workflows/x402-strict-smoke.yml` *(done by me)*
- [x] Workflow runs strict smoke gate *(done by me via workflow file inspection)*
- [x] Workflow runs negative smoke gate *(done by me via workflow file inspection)*
- [ ] Workflow fails correctly on non-zero smoke exit *(unable to do here: requires remote GitHub Actions run with forced failure)*

Notes / evidence:

---

## 12) Submission Evidence Bundle

- [x] Backend build output captured *(done by me)*
- [x] Dashboard build output captured *(done by me)*
- [x] Strict smoke JSON output captured *(done by me)*
- [x] Negative smoke JSON output captured *(done by me)*
- [ ] Screenshots captured:
  - [ ] readiness panel (`native_enabled`) *(unable to do: needs interactive UI capture)*
  - [ ] x402 revenue/payments panel *(unable to do: needs interactive UI capture)*
  - [ ] strict smoke pass output *(unable to do: image capture not produced in shell-only run)*

Evidence links / file paths:

---

## Final Go/No-Go

- [x] GO (all critical sections pass for backend/API/SDK and CI-config checks done by me)
- [ ] NO-GO (list blockers below)

Blocking issues:
- UI-interactive validations and screenshots are still manual (unable in shell-only execution mode).

