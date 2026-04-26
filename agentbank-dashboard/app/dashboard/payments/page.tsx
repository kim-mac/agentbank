'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useApp } from '@/lib/store'
import { Shell } from '@/components/ui/Shell'
import { getX402Payments, X402PaymentRow } from '@/lib/api'
import { RefreshCw, ExternalLink, ChevronLeft, ChevronRight, Filter } from 'lucide-react'

function formatUsdc(atomic: string) {
  return (Number(atomic) / 1_000_000).toFixed(6)
}

function shortAddr(a: string) {
  if (!a || a.length < 20) return a || '—'
  return `${a.slice(0, 8)}...${a.slice(-6)}`
}

type VerifiedFilter = 'all' | 'true' | 'false'

export default function X402PaymentsPage() {
  const { apiKey } = useApp()
  const [rows, setRows] = useState<X402PaymentRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [loading, setLoading] = useState(true)

  const [draftNetwork, setDraftNetwork] = useState('')
  const [draftFrom, setDraftFrom] = useState('')
  const [draftTo, setDraftTo] = useState('')
  const [draftVerified, setDraftVerified] = useState<VerifiedFilter>('all')

  const [appliedNetwork, setAppliedNetwork] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')
  const [appliedVerified, setAppliedVerified] = useState<VerifiedFilter>('all')

  const load = useCallback(async () => {
    if (!apiKey) return
    setLoading(true)
    try {
      const r = await getX402Payments(apiKey, {
        page,
        pageSize,
        network: appliedNetwork.trim() || undefined,
        from: appliedFrom || undefined,
        to: appliedTo || undefined,
        verified: appliedVerified === 'all' ? undefined : appliedVerified,
      })
      setRows(r.payments || [])
      setTotal(r.total)
    } catch {
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [apiKey, page, appliedNetwork, appliedFrom, appliedTo, appliedVerified])

  useEffect(() => { load() }, [load])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function applyFilters() {
    setAppliedNetwork(draftNetwork)
    setAppliedFrom(draftFrom)
    setAppliedTo(draftTo)
    setAppliedVerified(draftVerified)
    setPage(1)
  }

  function resetFilters() {
    setDraftNetwork('')
    setDraftFrom('')
    setDraftTo('')
    setDraftVerified('all')
    setAppliedNetwork('')
    setAppliedFrom('')
    setAppliedTo('')
    setAppliedVerified('all')
    setPage(1)
  }

  return (
    <Shell>
      <div style={{ padding: '32px 36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ marginBottom: 8 }}>
              <Link href="/dashboard/transactions" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>← Transactions & revenue</Link>
            </div>
            <h1 className="page-title">x402 payments</h1>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5 }}>
              {total} payment{total === 1 ? '' : 's'} matching filters
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={12} /> Refresh</button>
        </div>

        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            <Filter size={12} /> Filters
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr auto', gap: 8, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 10, color: 'var(--muted2)', display: 'block', marginBottom: 4 }}>Network (CAIP-2)</label>
              <input className="input" placeholder="e.g. eip155:84532" value={draftNetwork} onChange={e => setDraftNetwork(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--muted2)', display: 'block', marginBottom: 4 }}>From (UTC date)</label>
              <input className="input" type="date" value={draftFrom} onChange={e => setDraftFrom(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--muted2)', display: 'block', marginBottom: 4 }}>To (UTC date)</label>
              <input className="input" type="date" value={draftTo} onChange={e => setDraftTo(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--muted2)', display: 'block', marginBottom: 4 }}>Facilitator verified</label>
              <select
                className="input"
                value={draftVerified}
                onChange={e => setDraftVerified(e.target.value as VerifiedFilter)}
                style={{ cursor: 'pointer' }}
              >
                <option value="all">All</option>
                <option value="true">Verified</option>
                <option value="false">Not verified</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-primary btn-sm" onClick={applyFilters}>Apply</button>
              <button className="btn btn-ghost btn-sm" onClick={resetFilters}>Reset</button>
            </div>
          </div>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 20 }}>{[...Array(8)].map((_, i) => <div key={i} className="skeleton" style={{ height: 32, marginBottom: 8 }} />)}</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No x402 payments found</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                  {['Time', 'Network', 'USDC', 'Payer', 'Pay to', 'Endpoint', 'Verified', 'Settlement'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(p => {
                  const basescan = p.facilitatorTxHash && p.network?.includes('8453')
                    ? (p.network.includes('84532')
                      ? `https://sepolia.basescan.org/tx/${p.facilitatorTxHash}`
                      : `https://basescan.org/tx/${p.facilitatorTxHash}`)
                    : null
                  return (
                    <tr key={p.id} className="table-row">
                      <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--muted2)', whiteSpace: 'nowrap' }}>{new Date(p.createdAt).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px' }}><span className="badge badge-muted" style={{ fontSize: 10 }}>{p.network}</span></td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--mono)', fontSize: 12 }}>{formatUsdc(p.amountAtomic)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)' }} title={p.payerAddress}>{shortAddr(p.payerAddress)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)' }} title={p.payTo}>{shortAddr(p.payTo)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--muted)' }} title={p.endpoint}>{p.endpoint}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className={`badge ${p.facilitatorVerified ? 'badge-green' : 'badge-amber'}`} style={{ fontSize: 10 }}>
                          {p.facilitatorVerified ? 'yes' : 'no'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {basescan && p.facilitatorTxHash
                          ? <a href={basescan} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                              <ExternalLink size={11} /> Tx
                            </a>
                          : <span style={{ fontSize: 11, color: 'var(--muted2)' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {total > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Page {page} of {totalPages} · {total} total
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}
