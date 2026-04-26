# x402 Error and Readiness Contract

This document defines the stable response contract used by automation, CI, and dashboard UX.

## Premium Endpoint 402 Contract

Endpoint: `GET /v1/premium/insights`

When payment is required or invalid, the API returns HTTP `402` with:

- `PAYMENT-REQUIRED` header (base64 challenge payload)
- JSON body fields:
  - `error` (human-readable reason)
  - `errorCode` (stable machine code)
  - `remediation` (single next action)
  - `x402Version`
  - `accepts`

### Stable `errorCode` values

- `PAYMENT_REQUIRED`
- `INVALID_SIGNATURE_ENCODING`
- `MALFORMED_SIGNATURE_PAYLOAD`
- `UNSUPPORTED_PAYMENT_SCHEME`
- `PAYMENT_NETWORK_MISMATCH`
- `PAYMENT_AMOUNT_MISMATCH`
- `PAYMENT_ASSET_MISMATCH`
- `PAYMENT_DESTINATION_MISMATCH`
- `INVALID_PAYER_ADDRESS`
- `INVALID_PAYEE_ADDRESS`
- `AUTHORIZATION_PAYEE_MISMATCH`
- `AUTHORIZATION_VALUE_MISMATCH`
- `MISSING_AUTHORIZATION_NONCE`
- `INVALID_SIGNATURE_FORMAT`
- `INVALID_AUTHORIZATION_WINDOW`
- `AUTHORIZATION_OUTSIDE_WINDOW`
- `REPLAY_NONCE_USED`
- `FACILITATOR_VERIFICATION_FAILED`

## Agent Readiness Contract

Endpoint: `GET /v1/register/status`

Required x402 readiness fields:

- `x402Mode`: `not_enabled` | `proxy_enabled` | `native_enabled`
- `modeReason`: string
- `canUseProxyX402`: boolean
- `canUseNativeX402`: boolean
- `missingPrerequisites`: string[]
- `checks`: object
- `nextActions`: object with `stage`, `title`, `steps[]`, `commands`

### `missingPrerequisites` codes

- `claim_agent`
- `native_x402_requires_base_chain`
- `configure_api_base_url`
- `configure_x402_pricing`
- `configure_x402_pay_to`

## Operator Readiness Contract

Endpoint: `GET /v1/operators/x402/readiness`

Returns:

- `summary` counters (`totalAgents`, `nativeReady`, `proxyOnly`, `notEnabled`, `withBlockers`)
- `readiness[]` rows per agent
  - includes `missingPrerequisites`
  - includes `blockerHints[]` with `code` + `remediation`

## Compatibility Rule

These fields/codes are considered integration contract. Additive changes are allowed, but existing field names and codes should not be renamed without migration.
