// lib/api.ts — All AgentBank API calls

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1'

async function request<T>(method: string, path: string, apiKey: string, body?: object): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    ...(body && { body: JSON.stringify(body) }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any
    throw new Error(err.error || `API error ${res.status}`)
  }
  return res.json()
}

export interface Agent {
  id: string
  name: string
  description: string
  walletAddress: string
  chain: string
  status:        'active' | 'paused' | 'frozen'
  roleName?:     string
  roleDocument?: string
  inGroup?:      boolean
  balance: { native: number; unit: string }
  todaySpend: number
  dailyLimit: number
  policy: {
    dailyLimit: number
    txLimit: number
    requireApprovalAbove: number
    whitelistedAddresses: string[]
    allowedChains: string[]
    killSwitch: boolean
  }
  paperMode?:    boolean
  paperBalance?: number
  squadsEnabled?: boolean
  squadsMultisigPda?: string
  squadsVaultPda?: string
  squadsVaultIndex?: number
  squadsSpendingLimitPda?: string
  createdAt: string
}

export interface Transaction {
  id: string
  agentId: string
  chain: string
  fromAddress: string
  toAddress: string
  amount: number
  token: string
  status: 'pending_approval' | 'approved' | 'rejected' | 'confirmed' | 'failed'
  rejectReason?: string
  txHash?: string
  memo?: string
  createdAt: string
  confirmedAt?: string
}

export interface ApprovalRequest {
  approvalId: string
  transactionId: string
  agentName: string
  agentId: string
  amount: number
  token: string
  toAddress: string
  memo?: string
  chain: string
  createdAt: string
}

export interface RegisterResult {
  operatorId: string
  apiKey: string
  message: string
}

export interface X402Pricing {
  network: string
  amountAtomic: string
  asset: string
  payTo: string
  description: string
  maxTimeoutSeconds: number
}

export interface X402RevenuePayment {
  id: string
  endpoint: string
  network: string
  amountAtomic: string
  payerAddress: string
  payTo: string
  nonce: string
  facilitatorVerified: boolean
  facilitatorTxHash?: string
  createdAt: string
}

export interface X402RevenueStats {
  totalPayments: number
  totalAmountAtomic: string
  byNetwork: Record<string, { count: number; amountAtomic: string }>
  recentPayments: X402RevenuePayment[]
}

export interface X402ReadinessBlockerHint {
  code: string
  remediation: string
}

export interface X402AgentReadinessRow {
  agentId: string
  agentName: string
  chain: string
  status: string
  claimStatus: string
  x402Mode: 'not_enabled' | 'proxy_enabled' | 'native_enabled'
  canUseProxyX402: boolean
  canUseNativeX402: boolean
  missingPrerequisites: string[]
  blockerHints: X402ReadinessBlockerHint[]
}

export interface X402ReadinessSummary {
  totalAgents: number
  nativeReady: number
  proxyOnly: number
  notEnabled: number
  withBlockers: number
}

// ── Operators ──────────────────────────────────────────────────────────────

export const registerOperator = (email: string, orgName: string) =>
  request<RegisterResult>('POST', '/operators/register', '', { email, orgName })

// ── Agents ─────────────────────────────────────────────────────────────────

export const getAgents = (apiKey: string) =>
  request<{ agents: Agent[] }>('GET', '/operators/agents', apiKey)

export const createAgent = (apiKey: string, data: {
  name: string; description: string; walletAddress: string; chain: string; squadsEnabled?: boolean; policy: object
}) => request('POST', '/operators/agents', apiKey, data)

export const updateAgentRole = (apiKey: string, agentId: string, data: { roleName?: string; roleDocument?: string; inGroup: boolean }) =>
  request('PATCH', `/operators/agents/${agentId}/role`, apiKey, data)

export const getAgentDirectory = (apiKey: string) =>
  request<{ directory: any[]; groupChannelId: string; groupAgents: number }>('GET', '/operators/agents/directory', apiKey)

export const deleteAgent = (apiKey: string, agentId: string) =>
  request('DELETE', `/operators/agents/${agentId}`, apiKey)

export const freezeAgent = (apiKey: string, agentId: string, action: 'freeze' | 'unfreeze' | 'pause') =>
  request('POST', `/operators/agents/${agentId}/freeze`, apiKey, { action })

export const updatePolicy = (apiKey: string, agentId: string, policy: object) =>
  request('PATCH', `/operators/agents/${agentId}/policy`, apiKey, policy)

export const getAgentPolicy = (apiKey: string, agentId: string) =>
  request<{ policy: object }>('GET', `/operators/agents`, apiKey)

// ── Transactions ───────────────────────────────────────────────────────────

export const getTransactions = (apiKey: string) =>
  request<{ transactions: Transaction[] }>('GET', '/operators/transactions', apiKey)

export const getX402Pricing = (apiKey: string) =>
  request<{ pricing: X402Pricing }>('GET', '/operators/x402/pricing', apiKey)

export const updateX402Pricing = (apiKey: string, payload: Partial<X402Pricing>) =>
  request<{ pricing: X402Pricing; message: string; note?: string }>('PATCH', '/operators/x402/pricing', apiKey, payload)

export const getX402Revenue = (apiKey: string) =>
  request<{ revenue: X402RevenueStats; unit: string; hint: string }>('GET', '/operators/x402/revenue', apiKey)

export const getX402Readiness = (apiKey: string) =>
  request<{ summary: X402ReadinessSummary; readiness: X402AgentReadinessRow[] }>(
    'GET',
    '/operators/x402/readiness',
    apiKey
  )

export interface X402PaymentRow {
  id: string
  endpoint: string
  network: string
  amountAtomic: string
  asset: string
  payTo: string
  payerAddress: string
  nonce: string
  facilitatorVerified: boolean
  facilitatorTxHash?: string
  createdAt: string
}

export const getX402Payments = (apiKey: string, q: {
  page?: number
  pageSize?: number
  network?: string
  from?: string
  to?: string
  verified?: 'true' | 'false'
}) => {
  const sp = new URLSearchParams()
  if (q.page) sp.set('page', String(q.page))
  if (q.pageSize) sp.set('pageSize', String(q.pageSize))
  if (q.network) sp.set('network', q.network)
  if (q.from) sp.set('from', q.from)
  if (q.to) sp.set('to', q.to)
  if (q.verified) sp.set('verified', q.verified)
  const qs = sp.toString()
  return request<{ payments: X402PaymentRow[]; total: number; page: number; pageSize: number }>(
    'GET',
    `/operators/x402/payments${qs ? `?${qs}` : ''}`,
    apiKey
  )
}

// ── Approvals ─────────────────────────────────────────────────────────────

export const getApprovals = (apiKey: string) =>
  request<{ pendingApprovals: ApprovalRequest[] }>('GET', '/operators/approvals', apiKey)

export const resolveApproval = (apiKey: string, approvalId: string, action: 'approve' | 'reject') =>
  request('POST', `/operators/approvals/${approvalId}`, apiKey, { action })

// ── Claim flow ─────────────────────────────────────────────────────────────

export interface PendingClaim {
  agentId:       string
  agentName:     string
  walletAddress: string
  chain:         string
  claimToken:    string
  claimUrl:      string
  createdAt:     string
}

export const getPendingClaims = (apiKey: string) =>
  request<{ pendingClaims: PendingClaim[]; count: number }>('GET', '/operators/pending-claims', apiKey)

export const getPendingClaimsWithSkillUrl = (apiKey: string) =>
  request<{ pendingClaims: PendingClaim[]; count: number; personalSkillUrl: string }>(
    'GET', '/operators/pending-claims', apiKey
  )
