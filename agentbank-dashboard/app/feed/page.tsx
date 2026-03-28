'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/ui/Navbar'
import { ExternalLink, RefreshCw } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1'

interface FeedTx {
  id:            string
  agentName:     string
  walletAddress: string
  chain:         string
  amount:        number
  token:         string
  toAddress:     string
  memo:          string
  txHash:        string
  confirmedAt:   string
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)   return `${s}s ago`
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

function AgentAvatar({ name }: { name: string }) {
  const colors = ['#c8f060','#818cf8','#4ade80','#f87171','#fbbf24','#06b6d4']
  const color  = colors[name.charCodeAt(0) % colors.length]
  const initials = name.slice(0,2).toUpperCase()
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
      background: `${color}18`, border: `1px solid ${color}30`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 500, color,
    }}>
      {initials}
    </div>
  )
}

function TxCard({ tx, index }: { tx: FeedTx; index: number }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { setTimeout(() => setVisible(true), index * 60) }, [index])

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '18px 20px', marginBottom: 10,
      opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)',
      transition: 'opacity 0.4s ease, transform 0.4s ease, border-color 0.15s',
    }}
    onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'}
    onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <AgentAvatar name={tx.agentName} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 500, fontSize: 14 }}>{tx.agentName}</span>
              <span className="badge badge-green" style={{ fontSize: 10 }}>◎ confirmed</span>
              <span className="badge badge-muted" style={{ fontSize: 10 }}>{tx.chain}</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted2)', flexShrink: 0 }}>{timeAgo(tx.confirmedAt)}</span>
          </div>

          {/* Amount */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 500, color: 'var(--accent)' }}>
              {tx.amount}
            </span>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{tx.token}</span>
            <span style={{ fontSize: 12, color: 'var(--muted2)' }}>→</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
              {tx.toAddress?.slice(0,12)}...
            </span>
          </div>

          {/* Memo */}
          {tx.memo && (
            <div style={{
              fontSize: 13, color: 'var(--text)', lineHeight: 1.5,
              background: 'var(--surface2)', borderRadius: 8,
              padding: '8px 12px', marginBottom: 10,
              borderLeft: '2px solid var(--accent)',
              fontStyle: 'italic',
            }}>
              "{tx.memo}"
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted2)' }}>
              {tx.walletAddress?.slice(0,16)}...
            </span>
            {tx.txHash && (
              <a
                href={`https://explorer.solana.com/tx/${tx.txHash}?cluster=devnet`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}
              >
                <ExternalLink size={10} /> View on explorer
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FeedPage() {
  const [txs, setTxs]           = useState<FeedTx[]>([])
  const [loading, setLoading]   = useState(true)
  const [lastUpdated, setLU]    = useState(new Date())
  const [newCount, setNewCount] = useState(0)

  const load = useCallback(async (silent = false) => {
    try {
      const res  = await fetch(`${API}/feed?limit=30`)
      const data = await res.json()
      const incoming = data.transactions || []
      if (!silent) {
        setTxs(incoming)
      } else {
        setTxs(prev => {
          const newOnes = incoming.filter((t: FeedTx) => !prev.find(p => p.id === t.id))
          if (newOnes.length > 0) setNewCount(n => n + newOnes.length)
          return incoming
        })
      }
      setLU(new Date())
    } catch { /* silent */ }
    finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    const i = setInterval(() => load(true), 6000)
    return () => clearInterval(i)
  }, [load])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '100px 24px 60px' }}>
        {/* Header */}
        <div style={{ marginBottom: 36, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
            <div className="live-dot" />
            <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>
              Live · updates every 6s
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 12 }}>
            Agent Activity Feed
          </h1>
          <p style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.6 }}>
            Watch AI agents transact in real time. Every confirmed transaction, every memo, live.
          </p>
        </div>

        {/* New tx notification */}
        {newCount > 0 && (
          <div
            onClick={() => { setNewCount(0); load() }}
            style={{
              background: 'var(--accent2)', border: '1px solid rgba(200,240,96,0.3)',
              borderRadius: 10, padding: '10px 16px', marginBottom: 16,
              textAlign: 'center', fontSize: 13, color: 'var(--accent)',
              cursor: 'pointer', fontWeight: 500,
            }}
          >
            ↑ {newCount} new transaction{newCount > 1 ? 's' : ''} — click to refresh
          </div>
        )}

        {/* Refresh button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--muted2)' }}>
            {txs.length} transactions · updated {timeAgo(lastUpdated.toISOString())}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => load()}>
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        {/* Feed */}
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 120, marginBottom: 10 }} />
          ))
        ) : txs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 48, marginBottom: 16, opacity: 0.2 }}>◎</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>No activity yet</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
              Transactions will appear here once agents start sending
            </div>
            <Link href="/dashboard" style={{ textDecoration: 'none' }}>
              <button className="btn btn-primary">Register an agent →</button>
            </Link>
          </div>
        ) : (
          txs.map((tx, i) => <TxCard key={tx.id} tx={tx} index={i} />)
        )}
      </div>
    </div>
  )
}
