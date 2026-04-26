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

// ── Operators ──────────────────────────────────────────────────────────────

export const registerOperator = (email: string, orgName: string) =>
  request<RegisterResult>('POST', '/operators/register', '', { email, orgName })

// ── Agents ─────────────────────────────────────────────────────────────────

export const getAgents = (apiKey: string) =>
  request<{ agents: Agent[] }>('GET', '/operators/agents', apiKey)

export const createAgent = (apiKey: string, data: {
  name: string; description: string; walletAddress: string; chain: string; policy: object
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
