'use client'
import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/lib/store'
import { Shell } from '@/components/ui/Shell'
import { getTransactions, getAgents, Transaction, Agent } from '@/lib/api'
import { RefreshCw, ExternalLink, Search } from 'lucide-react'

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { confirmed: 'badge-green', rejected: 'badge-red', pending_approval: 'badge-amber', failed: 'badge-red', approved: 'badge-accent' }
  return <span className={`badge ${map[status] || 'badge-muted'}`}>{status.replace('_', ' ')}</span>
}

export default function TransactionsPage() {
  const { apiKey } = useApp()
  const [txs, setTxs]         = useState<Transaction[]>([])
  const [agents, setAgents]   = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all')
  const [search, setSearch]   = useState('')

  const load = useCallback(async () => {
    if (!apiKey) return
    try {
      const [t, a] = await Promise.all([getTransactions(apiKey), getAgents(apiKey)])
      setTxs(t.transactions || []); setAgents(a.agents || [])
    } catch {} finally { setLoading(false) }
  }, [apiKey])

  useEffect(() => { load(); const i = setInterval(load, 8000); return () => clearInterval(i) }, [load])

  const agentMap = Object.fromEntries(agents.map(a => [a.id, a.name]))
  const statuses = ['all', 'confirmed', 'pending_approval', 'rejected', 'failed']
  const filtered = txs
    .filter(t => filter === 'all' || t.status === filter)
    .filter(t => !search || (agentMap[t.agentId] || '').toLowerCase().includes(search.toLowerCase()) || (t.memo || '').toLowerCase().includes(search.toLowerCase()) || t.toAddress.toLowerCase().includes(search.toLowerCase()))

  const confirmed = txs.filter(t => t.status === 'confirmed')
  const totalVol  = confirmed.reduce((s, t) => s + t.amount, 0)

  return (
    <Shell>
      <div style={{ padding: '32px 36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 className="page-title">Transactions</h1>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="live-dot" /> Live · {txs.length} total
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={12} /> Refresh</button>
        </div>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
          {[
            ['Volume',    `${totalVol.toFixed(4)}`, 'SOL confirmed', 'var(--accent)'],
            ['Confirmed', String(confirmed.length),  'transactions',  'var(--green)'],
            ['Rejected',  String(txs.filter(t => t.status === 'rejected').length), 'transactions', 'var(--red)'],
            ['Pending',   String(txs.filter(t => t.status === 'pending_approval').length), 'approvals', 'var(--amber)'],
          ].map(([l, v, sub, c]) => (
            <div key={l} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{l}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 500, color: c }}>{v}</div>
              <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 3 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted2)' }} />
            <input className="input" style={{ paddingLeft: 30, fontSize: 12 }} placeholder="Search agent, memo, address..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {statuses.map(s => (
              <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(s)} style={{ fontSize: 11, padding: '4px 10px' }}>
                {s === 'pending_approval' ? 'pending' : s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 20 }}>{[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 30, marginBottom: 8 }} />)}</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No transactions found</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                  {['Agent','Amount','To','Status','Memo','Time','Tx'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(tx => (
                  <tr key={tx.id} className="table-row">
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>{agentMap[tx.agentId] || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--mono)' }}>{tx.amount} {tx.token}</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{tx.toAddress?.slice(0,14)}...</td>
                    <td style={{ padding: '10px 14px' }}><StatusBadge status={tx.status} /></td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.memo}>{tx.memo || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--muted2)', whiteSpace: 'nowrap' }}>{timeAgo(tx.createdAt)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {tx.txHash
                        ? <a href={`https://explorer.solana.com/tx/${tx.txHash}?cluster=devnet`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, textDecoration: 'none' }}>
                            <ExternalLink size={11} /> View
                          </a>
                        : <span style={{ color: 'var(--muted2)', fontSize: 11 }}>—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Shell>
  )
}
