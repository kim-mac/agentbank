'use client'
import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/lib/store'
import { Shell } from '@/components/ui/Shell'
import { getApprovals, resolveApproval, ApprovalRequest } from '@/lib/api'
import { CheckCircle, XCircle, Clock, RefreshCw, Zap } from 'lucide-react'

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  return `${Math.floor(s/3600)}h ago`
}

export default function ApprovalsPage() {
  const { apiKey } = useApp()
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [loading, setLoading]     = useState(true)
  const [acting, setActing]       = useState<string | null>(null)
  const [resolved, setResolved]   = useState<{ id: string; action: string }[]>([])

  const load = useCallback(async () => {
    if (!apiKey) return
    try { const r = await getApprovals(apiKey); setApprovals(r.pendingApprovals || []) } catch {} finally { setLoading(false) }
  }, [apiKey])

  useEffect(() => { load(); const i = setInterval(load, 5000); return () => clearInterval(i) }, [load])

  async function decide(approvalId: string, action: 'approve' | 'reject') {
    setActing(approvalId)
    try {
      await resolveApproval(apiKey, approvalId, action)
      setResolved(r => [...r, { id: approvalId, action }])
      setTimeout(() => {
        setApprovals(a => a.filter(x => x.approvalId !== approvalId))
        setResolved(r => r.filter(x => x.id !== approvalId))
      }, 1500)
    } catch {} finally { setActing(null) }
  }

  return (
    <Shell>
      <div style={{ padding: '32px 36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h1 className="page-title">Approvals</h1>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="live-dot" /> Auto-refreshes every 5s
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={12} /> Refresh</button>
        </div>

        {loading ? (
          [...Array(2)].map((_, i) => <div key={i} className="skeleton" style={{ height: 200, marginBottom: 12, borderRadius: 14 }} />)
        ) : approvals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <CheckCircle size={32} color="var(--green)" style={{ marginBottom: 14, opacity: 0.7 }} />
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--text)', marginBottom: 6 }}>All clear</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>No transactions waiting for approval</div>
          </div>
        ) : approvals.map(a => {
          const resolvedItem = resolved.find(r => r.id === a.approvalId)
          return (
            <div key={a.approvalId} className="card animate-in" style={{
              marginBottom: 12, overflow: 'hidden',
              borderColor: resolvedItem ? (resolvedItem.action === 'approve' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)') : 'rgba(251,191,36,0.25)',
              opacity: resolvedItem ? 0.6 : 1, transition: 'all 0.3s',
            }}>
              <div style={{ height: 2, background: resolvedItem ? (resolvedItem.action === 'approve' ? 'var(--green)' : 'var(--red)') : 'var(--amber)' }} />
              <div style={{ padding: 24 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--amber-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Zap size={14} color="var(--amber)" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{a.agentName}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Clock size={10} /> {timeAgo(a.createdAt)}
                    </div>
                  </div>
                  <span className="badge badge-amber" style={{ marginLeft: 'auto' }}>Awaiting approval</span>
                </div>

                {/* Amount */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 10 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 36, fontWeight: 500, letterSpacing: '-1px', color: 'var(--text)' }}>{a.amount}</span>
                  <span style={{ fontSize: 15, color: 'var(--muted)', fontWeight: 500 }}>{a.token}</span>
                </div>

                {/* To */}
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                  To: <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)', fontSize: 11 }}>{a.toAddress?.slice(0,22)}...</span>
                  <span className="badge badge-indigo" style={{ marginLeft: 8, fontSize: 10 }}>{a.chain}</span>
                </div>

                {/* Memo */}
                <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', borderLeft: '2px solid rgba(251,191,36,0.4)' }}>
                  "{a.memo || 'No reason provided'}"
                </div>

                {/* Actions */}
                {resolvedItem ? (
                  <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 500, color: resolvedItem.action === 'approve' ? 'var(--green)' : 'var(--red)' }}>
                    {resolvedItem.action === 'approve' ? '✓ Approved — agent will sign and broadcast' : '✕ Rejected'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-success" style={{ flex: 1, justifyContent: 'center' }} onClick={() => decide(a.approvalId, 'approve')} disabled={!!acting}>
                      <CheckCircle size={13} /> {acting === a.approvalId ? 'Approving...' : 'Approve'}
                    </button>
                    <button className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={() => decide(a.approvalId, 'reject')} disabled={!!acting}>
                      <XCircle size={13} /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Shell>
  )
}
