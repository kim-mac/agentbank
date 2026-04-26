# AgentStack Canonical Quickstart (Submission)

This is the single recommended flow for AI-agent onboarding and x402 usage.

## Goal

In one run, verify:

1. wallet generation
2. agent registration + claim
3. policy-governed activation
4. native x402 paid request success
5. deterministic failure-path handling

## Prerequisites

- Backend running at `http://localhost:3011`
- SDK dependencies installed in `agentbank-clean/sdk`
- `X402_PAY_TO` configured to a real Base address

## Commands (copy/paste)

From `agentbank-clean/sdk`:

```bash
npm run smoke:onboarding:strict
npm run smoke:x402:negative
```

## Expected Success Output

### Strict onboarding smoke

- `"pass": true`
- `"exitCode": 0`
- `"x402Mode": "native_enabled"`
- `"missingPrerequisites": []`
- strict checks all `true`

### Negative smoke

- `"pass": true`
- `"total": 5`
- `"failed": 0`
- each negative case returns `402` with:
  - `error`
  - `errorCode`
  - `remediation`

## If Something Fails

- `register` failure:
  - verify backend health: `GET /health`
  - verify `AGENTBANK_API_URL`
- `strict` failure (`exitCode: 14`):
  - check `/v1/register/status` for `missingPrerequisites`
  - fix blockers (especially `configure_x402_pay_to`)
- negative smoke failure:
  - verify premium route is current version
  - verify deterministic `errorCode` contract in `backend/src/routes/premium-routes.ts`

## Submission Claim This Validates

AgentStack provides wallet + payment + policy management for AI agents with integration in minutes through a reproducible SDK flow and operator controls.
