'use client'
import { useState, useEffect } from 'react'
import { useApp } from '@/lib/store'
import { Wallet, CheckCircle, AlertCircle, Loader, ArrowRight, Bot, Shield, Zap } from 'lucide-react'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1'

interface AgentInfo {
  agentId:       string
  agentName:     string
  description:   string
  walletAddress: string
  chain:         string
  claimStatus:   string
  createdAt:     string
  operatorOrg:   string
  policy: {
    dailyLimit:           number
    txLimit:              number
    requireApprovalAbove: number
  }
}

export default function ClaimPage({ params }: { params: { token: string } }) {
  const { apiKey } = useApp()
  const [agent, setAgent]       = useState<AgentInfo | null>(null)
  const [loading, setLoading]   = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed]   = useState(false)
  const [error, setError]       = useState('')
  const [keyInput, setKeyInput] = useState('')

  useEffect(() => {
    fetch(`${API}/claim/${params.token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else {
          setAgent(data)
          if (data.claimStatus === 'claimed') setClaimed(true)
        }
      })
      .catch(() => setError('Cannot reach AgentBank backend'))
      .finally(() => setLoading(false))
  }, [params.token])

  async function claim() {
    const key = apiKey || keyInput
    if (!key) { setError('Enter your operator API key to claim this agent'); return }
    setClaiming(true); setError('')
    try {
      const res = await fetch(`${API}/claim/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to claim agent'); return }
      setClaimed(true)
    } catch {
      setError('Network error — is the backend running?')
    } finally { setClaiming(false) }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <Loader size={24} color="var(--accent)" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, background: 'var(--accent)', borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Wallet size={24} color="#fff" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.5px', color: 'var(--text)' }}>AgentBank</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>Agent Claim</div>
        </div>

        {/* Invalid token */}
        {error && !agent && (
          <div className="card" style={{ padding: 28, textAlign: 'center' }}>
            <AlertCircle size={36} color="var(--red)" style={{ marginBottom: 14 }} />
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8, color: 'var(--text)' }}>Invalid Claim Link</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>{error}</div>
            <Link href="/">
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>Go to Dashboard</button>
            </Link>
          </div>
        )}

        {/* Already claimed */}
        {claimed && (
          <div className="card animate-in" style={{ padding: 28, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, background: 'var(--green-bg)', borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <CheckCircle size={28} color="var(--green)" />
            </div>
            <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8, color: 'var(--text)' }}>Agent Activated!</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 6 }}>
              <strong style={{ color: 'var(--text)' }}>{agent?.agentName}</strong> is now active and can transact within its policy limits.
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 24, fontFamily: 'DM Mono, monospace', background: 'var(--surface2)', padding: '6px 10px', borderRadius: 6 }}>
              {agent?.walletAddress.slice(0,20)}...
            </div>
            <Link href="/">
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                View in Dashboard <ArrowRight size={14} />
              </button>
            </Link>
          </div>
        )}

        {/* Claim form */}
        {agent && !claimed && (
          <div className="card animate-in" style={{ overflow: 'hidden' }}>
            {/* Top strip */}
            <div style={{ height: 3, background: 'var(--amber)' }} />
            <div style={{ padding: 28 }}>

              {/* Agent info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '14px 16px', background: 'var(--surface2)', borderRadius: 10 }}>
                <div style={{ width: 40, height: 40, background: 'var(--accent2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bot size={20} color="var(--accent)" />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{agent.agentName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{agent.description || 'AI Agent'}</div>
                </div>
                <span className="badge badge-amber" style={{ marginLeft: 'auto' }}>Pending</span>
              </div>

              {/* What they're claiming */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Agent Details</div>
                {[
                  ['Wallet', `${agent.walletAddress.slice(0,18)}...`],
                  ['Chain',  agent.chain],
                  ['Daily limit',    `${agent.policy.dailyLimit} SOL`],
                  ['TX limit',       `${agent.policy.txLimit} SOL`],
                  ['Approval above', `${agent.policy.requireApprovalAbove} SOL`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--text3)' }}>{k}</span>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text)' }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* What claiming means */}
              <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: 14, marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>By claiming this agent you can</div>
                {[
                  [Shield, 'Set and update spending policies'],
                  [CheckCircle, 'Approve large transactions'],
                  [Zap, 'Freeze or pause the agent anytime'],
                ].map(([Icon, text]: any) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, fontSize: 12, color: 'var(--text2)' }}>
                    <Icon size={12} color="var(--accent)" />
                    {text}
                  </div>
                ))}
              </div>

              {/* API key input if not logged in */}
              {!apiKey && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, display: 'block' }}>
                    Your Operator API Key
                  </label>
                  <input
                    className="input"
                    type="password"
                    placeholder="op_xxxxxxxxxxxxxxxx"
                    value={keyInput}
                    onChange={e => setKeyInput(e.target.value)}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                    From your dashboard. <Link href="/" style={{ color: 'var(--accent)' }}>Sign in first →</Link>
                  </div>
                </div>
              )}

              {apiKey && (
                <div style={{ fontSize: 12, color: 'var(--green)', background: 'var(--green-bg)', padding: '7px 10px', borderRadius: 7, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={12} /> Signed in as operator
                </div>
              )}

              {error && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={12} /> {error}
                </div>
              )}

              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px 16px' }} onClick={claim} disabled={claiming}>
                {claiming
                  ? <><Loader size={14} /> Activating...</>
                  : <><CheckCircle size={14} /> Activate Agent</>
                }
              </button>

              <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 10 }}>
                The agent will be able to transact once you activate it
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
