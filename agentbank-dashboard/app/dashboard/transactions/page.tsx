'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useApp } from '@/lib/store'
import { Shell } from '@/components/ui/Shell'
import {
  getTransactions,
  getAgents,
  getX402Pricing,
  updateX402Pricing,
  getX402Revenue,
  getX402Readiness,
  Transaction,
  Agent,
  X402Pricing,
  X402RevenueStats,
  X402ReadinessSummary,
  X402AgentReadinessRow
} from '@/lib/api'
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
  const [pricing, setPricing] = useState<X402Pricing | null>(null)
  const [revenue, setRevenue] = useState<X402RevenueStats | null>(null)
  const [readinessSummary, setReadinessSummary] = useState<X402ReadinessSummary | null>(null)
  const [readinessRows, setReadinessRows] = useState<X402AgentReadinessRow[]>([])
  const [pricingForm, setPricingForm] = useState({ amountAtomic: '', payTo: '', description: '' })
  const [savingPricing, setSavingPricing] = useState(false)

  const load = useCallback(async () => {
    if (!apiKey) return
    try {
      const [t, a, p, r, x402Ready] = await Promise.all([
        getTransactions(apiKey),
        getAgents(apiKey),
        getX402Pricing(apiKey),
        getX402Revenue(apiKey),
        getX402Readiness(apiKey),
      ])
      setTxs(t.transactions || []); setAgents(a.agents || [])
      setPricing(p.pricing)
      setRevenue(r.revenue)
      setReadinessSummary(x402Ready.summary)
      setReadinessRows(x402Ready.readiness || [])
      setPricingForm({
        amountAtomic: p.pricing.amountAtomic,
        payTo: p.pricing.payTo,
        description: p.pricing.description,
      })
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
  const formatUsd = (atomic: string) => (Number(atomic) / 1_000_000).toFixed(6)
  const short = (v: string) => `${v.slice(0, 10)}...${v.slice(-6)}`

  async function savePricing() {
    if (!apiKey) return
    setSavingPricing(true)
    try {
      const res = await updateX402Pricing(apiKey, {
        amountAtomic: pricingForm.amountAtomic.trim(),
        payTo: pricingForm.payTo.trim(),
        description: pricingForm.description.trim(),
      })
      setPricing(res.pricing)
    } catch (e: any) {
      alert(e.message || 'Failed to update x402 pricing')
    } finally {
      setSavingPricing(false)
    }
  }

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
            ['Volume',    `${totalVol.toFixed(4)}`, 'confirmed', 'var(--accent)'],
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

        {/* x402 revenue */}
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--muted2)', letterSpacing: '0.07em' }}>
              x402 Revenue
            </div>
            <Link href="/dashboard/payments" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>
              View all payments →
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 10 }}>
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Total USDC</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 18 }}>{revenue ? formatUsd(revenue.totalAmountAtomic) : '0.000000'}</div>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Payments</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 18 }}>{revenue?.totalPayments || 0}</div>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Networks</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {revenue && Object.keys(revenue.byNetwork).length > 0
                  ? Object.entries(revenue.byNetwork).map(([n, row]) => `${n}: ${row.count}`).join(' · ')
                  : 'No payments yet'}
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Recent x402 Payments
            </div>
            {revenue?.recentPayments?.length ? (
              <div style={{ display: 'grid', gap: 6 }}>
                {revenue.recentPayments.slice(0, 5).map(p => (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.6fr 1fr', gap: 8, fontSize: 11, alignItems: 'center' }}>
                    <span className="badge badge-muted" style={{ width: 'fit-content' }}>{p.network}</span>
                    <span style={{ fontFamily: 'var(--mono)' }}>{formatUsd(p.amountAtomic)} USDC</span>
                    <span style={{ color: 'var(--muted)', fontFamily: 'var(--mono)' }} title={p.payerAddress}>{short(p.payerAddress)}</span>
                    <span style={{ color: p.facilitatorVerified ? 'var(--green)' : 'var(--amber)' }}>
                      {p.facilitatorVerified ? 'verified' : 'pending verify'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>No x402 payments recorded yet</div>
            )}
          </div>
        </div>

        {/* x402 readiness */}
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--muted2)', letterSpacing: '0.07em' }}>
              x402 Native Readiness
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              {readinessSummary
                ? `${readinessSummary.nativeReady}/${readinessSummary.totalAgents} native-ready`
                : 'loading...'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 10 }}>
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Native Ready</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 18 }}>{readinessSummary?.nativeReady || 0}</div>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Proxy Only</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 18 }}>{readinessSummary?.proxyOnly || 0}</div>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Not Enabled</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 18 }}>{readinessSummary?.notEnabled || 0}</div>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>With Blockers</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 18 }}>{readinessSummary?.withBlockers || 0}</div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Agent Blockers
            </div>
            {readinessRows.length ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {readinessRows.map(row => (
                  <div key={row.agentId} style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>
                        {row.agentName} <span style={{ color: 'var(--muted2)' }}>({row.chain})</span>
                      </div>
                      <span className={`badge ${row.x402Mode === 'native_enabled' ? 'badge-green' : row.x402Mode === 'proxy_enabled' ? 'badge-amber' : 'badge-red'}`}>
                        {row.x402Mode}
                      </span>
                    </div>
                    {row.blockerHints.length ? (
                      <div style={{ display: 'grid', gap: 4 }}>
                        {row.blockerHints.map((h, idx) => (
                          <div key={`${row.agentId}-${h.code}-${idx}`} style={{ fontSize: 11, color: 'var(--muted)' }}>
                            <span style={{ fontFamily: 'var(--mono)', color: 'var(--amber)' }}>{h.code}</span>
                            {' — '}
                            {h.remediation}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--green)' }}>No blockers. Native x402 is ready.</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>No readiness data yet</div>
            )}
          </div>
        </div>

        {/* x402 seller config */}
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--muted2)', letterSpacing: '0.07em' }}>
              x402 Premium Endpoint Pricing
            </div>
            {pricing && (
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {pricing.network} · {formatUsd(pricing.amountAtomic)} USDC
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr 1.8fr auto', gap: 8 }}>
            <input
              className="input"
              placeholder="Amount atomic"
              value={pricingForm.amountAtomic}
              onChange={e => setPricingForm(f => ({ ...f, amountAtomic: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Pay-to address"
              value={pricingForm.payTo}
              onChange={e => setPricingForm(f => ({ ...f, payTo: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Description"
              value={pricingForm.description}
              onChange={e => setPricingForm(f => ({ ...f, description: e.target.value }))}
            />
            <button className="btn btn-primary btn-sm" onClick={savePricing} disabled={savingPricing}>
              {savingPricing ? 'Saving...' : 'Save'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 8 }}>
            Changes apply immediately to `/v1/premium/insights` and reset on backend restart.
          </div>
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
                  {['Agent','Chain','Amount','To','Status','Memo','Time','Tx'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(tx => {
                  const explorerUrl = tx.chain === 'base'
                    ? `https://sepolia.basescan.org/tx/${tx.txHash}`
                    : `https://explorer.solana.com/tx/${tx.txHash}?cluster=devnet`
                  return (
                    <tr key={tx.id} className="table-row">
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>{agentMap[tx.agentId] || '—'}</td>
                      <td style={{ padding: '10px 14px' }}><span className="badge badge-muted" style={{ fontSize: 10 }}>{tx.chain}</span></td>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--mono)' }}>{tx.amount} {tx.token}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{tx.toAddress?.slice(0,14)}...</td>
                      <td style={{ padding: '10px 14px' }}><StatusBadge status={tx.status} /></td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.memo}>{tx.memo || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--muted2)', whiteSpace: 'nowrap' }}>{timeAgo(tx.createdAt)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {tx.txHash
                          ? <a href={explorerUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, textDecoration: 'none' }}>
                              <ExternalLink size={11} /> View
                            </a>
                          : <span style={{ color: 'var(--muted2)', fontSize: 11 }}>—</span>
                        }
                      </td>
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
