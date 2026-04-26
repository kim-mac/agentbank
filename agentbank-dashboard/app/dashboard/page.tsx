'use client'
import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/lib/store'
import { Shell } from '@/components/ui/Shell'
import { getAgents, getTransactions, getApprovals, getPendingClaimsWithSkillUrl, Agent, Transaction, PendingClaim } from '@/lib/api'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, Bot, ArrowLeftRight, RefreshCw, AlertTriangle, Copy, ExternalLink } from 'lucide-react'
import Link from 'next/link'

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return `${Math.floor(s/86400)}d ago`
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { confirmed: 'badge-green', rejected: 'badge-red', pending_approval: 'badge-amber', failed: 'badge-red', approved: 'badge-accent' }
  return <span className={`badge ${map[status] || 'badge-muted'}`}>{status.replace('_', ' ')}</span>
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="card animate-in" style={{ padding: '20px 22px' }}>
      <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>{label}</div>
      <div className="stat-value" style={{ color: accent ? 'var(--accent)' : 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

export default function OverviewPage() {
  const { apiKey } = useApp()
  const [agents, setAgents]         = useState<Agent[]>([])
  const [txs, setTxs]               = useState<Transaction[]>([])
  const [approvalCount, setAC]      = useState(0)
  const [pendingClaims, setPending] = useState<PendingClaim[]>([])
  const [skillUrl, setSkillUrl]     = useState('')
  const [loading, setLoading]       = useState(true)
  const [lastUpdated, setLU]        = useState(new Date())
  const [copied, setCopied]         = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!apiKey) return
    try {
      const [a, t, ap, pc] = await Promise.all([
        getAgents(apiKey), getTransactions(apiKey),
        getApprovals(apiKey), getPendingClaimsWithSkillUrl(apiKey),
      ])
      setAgents(a.agents || [])
      setTxs(t.transactions || [])
      setAC(ap.pendingApprovals?.length || 0)
      setPending(pc.pendingClaims || [])
      if (pc.personalSkillUrl) setSkillUrl(pc.personalSkillUrl)
      setLU(new Date())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [apiKey])

  useEffect(() => { load(); const i = setInterval(load, 8000); return () => clearInterval(i) }, [load])

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url)
    setCopied(url); setTimeout(() => setCopied(null), 2000)
  }

  const chartData = (() => {
    const days: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      days[d.toISOString().split('T')[0]] = 0
    }
    txs.filter(t => t.status === 'confirmed').forEach(t => {
      const d = t.createdAt.split('T')[0]
      if (days[d] !== undefined) days[d] += t.amount
    })
    return Object.entries(days).map(([date, spend]) => ({
      date: new Date(date).toLocaleDateString('en', { weekday: 'short' }),
      spend: parseFloat(spend.toFixed(4)),
    }))
  })()

  const totalSpend   = txs.filter(t => t.status === 'confirmed').reduce((s, t) => s + t.amount, 0)
  const activeAgents = agents.filter(a => a.status === 'active').length
  const confirmedTxs = txs.filter(t => t.status === 'confirmed').length

  return (
    <Shell>
      <div style={{ padding: '32px 36px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 className="page-title">Overview</h1>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="live-dot" />
              Live · updated {timeAgo(lastUpdated.toISOString())}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={12} /> Refresh</button>
            <Link href="/dashboard/agents"><button className="btn btn-primary btn-sm">+ New Agent</button></Link>
          </div>
        </div>

        {/* Pending claims */}
        {pendingClaims.length > 0 && (
          <div style={{ background: 'var(--amber-bg)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <AlertTriangle size={14} color="var(--amber)" />
              <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--amber)' }}>
                {pendingClaims.length} agent{pendingClaims.length > 1 ? 's' : ''} waiting to be claimed
              </span>
            </div>
            {pendingClaims.map(claim => (
              <div key={claim.agentId} style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', marginBottom: 6 }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{claim.agentName}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)', marginTop: 2 }}>{claim.walletAddress.slice(0,18)}...</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--muted2)' }}>{timeAgo(claim.createdAt)}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => copyUrl(claim.claimUrl)}>
                    <Copy size={11} />{copied === claim.claimUrl ? 'Copied!' : 'Copy'}
                  </button>
                  <Link href={`/claim/${claim.claimToken}`}>
                    <button className="btn btn-primary btn-sm"><ExternalLink size={11} /> Claim</button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add another agent */}
        {skillUrl && (
          <div className="card" style={{ padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, background: 'var(--accent2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bot size={14} color="var(--accent)" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Add another agent</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Send this URL to your next agent — registers under your account automatically</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', background: 'var(--surface2)', padding: '5px 10px', borderRadius: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {skillUrl}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => copyUrl(skillUrl)}>
                <Copy size={11} />{copied === skillUrl ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 86 }} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            <StatCard label="Active Agents"     value={String(activeAgents)}           sub={`${agents.length} total`} />
            <StatCard label="Today's Spend"     value={`${totalSpend.toFixed(4)}`}     sub="SOL across all agents" accent />
            <StatCard label="Confirmed Txs"     value={String(confirmedTxs)}           sub="all time" />
            <StatCard label="Pending Approvals" value={String(approvalCount)}          sub={approvalCount > 0 ? 'action needed' : 'all clear'} accent={approvalCount > 0} />
          </div>
        )}

        {/* Chart + agents */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {/* Spend chart */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 18 }}>
              <TrendingUp size={13} color="var(--accent)" />
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Spend — 7 days</span>
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#c8f060" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#c8f060" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted2)', fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted2)', fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text)', fontFamily: 'var(--mono)' }} formatter={(v: any) => [`${v} SOL`, '']} />
                <Area type="monotone" dataKey="spend" stroke="#c8f060" strokeWidth={1.5} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Agent list */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 18 }}>
              <Bot size={13} color="var(--accent)" />
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Agents</span>
            </div>
            {loading ? [...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 34, marginBottom: 8 }} />) :
             agents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)', fontSize: 13 }}>
                No agents yet — <Link href="/dashboard/agents" style={{ color: 'var(--accent)', textDecoration: 'none' }}>create one</Link>
              </div>
            ) : agents.slice(0, 5).map(agent => {
              const pct = agent.dailyLimit > 0 ? Math.min(100, (agent.todaySpend / agent.dailyLimit) * 100) : 0
              return (
                <div key={agent.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className={`status-dot ${agent.status}`} />
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{agent.name}</span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>{agent.todaySpend.toFixed(3)}/{agent.dailyLimit}</span>
                  </div>
                  <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: pct > 80 ? 'var(--red)' : pct > 60 ? 'var(--amber)' : 'var(--accent)', transition: 'width 0.4s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent transactions */}
        <div className="card">
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <ArrowLeftRight size={13} color="var(--accent)" />
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recent Transactions</span>
            </div>
            <Link href="/dashboard/transactions" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>View all →</Link>
          </div>
          {loading ? <div style={{ padding: 20 }}>{[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 28, marginBottom: 8 }} />)}</div> :
           txs.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No transactions yet</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Agent','Amount','To','Status','Memo','Time'].map(h => (
                    <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txs.slice(0, 8).map(tx => {
                  const agent = agents.find(a => a.id === tx.agentId)
                  return (
                    <tr key={tx.id} className="table-row">
                      <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500 }}>{agent?.name || '—'}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12, fontFamily: 'var(--mono)' }}>{tx.amount} {tx.token}</td>
                      <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{tx.toAddress?.slice(0,12)}...</td>
                      <td style={{ padding: '10px 16px' }}><StatusBadge status={tx.status} /></td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.memo || '—'}</td>
                      <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--muted2)' }}>{timeAgo(tx.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Shell>
  )
}
