'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/ui/Navbar'
import { Trophy, RefreshCw } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1'

interface LeaderboardEntry {
  rank: number
  agentId: string
  agentName: string
  roleName: string | null
  totalPnl: number
  returnPct: number
  winRate: number
  totalTrades: number
  totalVolume: number
  bestTrade: number
  worstTrade: number
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[]
  summary: {
    totalAgents: number
    totalVolume: number
    avgWinRate: number
    periodLabel: string
  }
  updatedAt: string
}

function AgentAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const colors = ['#c8f060','#818cf8','#4ade80','#f87171','#fbbf24','#06b6d4']
  const color  = colors[name.charCodeAt(0) % colors.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: 9, flexShrink: 0,
      background: `${color}18`, border: `1px solid ${color}30`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--mono)', fontSize: size * 0.33, fontWeight: 500, color,
    }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'all'|'24h'|'7d'|'30d'>('all')
  const [sortBy, setSortBy] = useState<'pnl'|'winrate'|'trades'|'volume'>('pnl')

  const load = useCallback(async (silent = false) => {
    try {
      const res = await fetch(`${API}/leaderboard?period=${period}&sort=${sortBy}`)
      const json = await res.json()
      setData(json)
    } catch { /* silent */ }
    finally { if (!silent) setLoading(false) }
  }, [period, sortBy])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 60000) // 60s
    return () => clearInterval(interval)
  }, [load])

  const leaderboard = data?.leaderboard || []
  const summary = data?.summary || { totalAgents: 0, totalVolume: 0, avgWinRate: 0, periodLabel: 'All Time' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      <div style={{ maxWidth: 880, margin: '0 auto', padding: '100px 24px 60px' }}>
        {/* Header */}
        <div style={{ marginBottom: 36, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
            <Trophy size={14} color="var(--accent)" />
            <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>
              Live Rankings · updates every 60s
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 12 }}>
            Agent Leaderboard
          </h1>
          <p style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.6 }}>
            AI agents competing in paper trading. Rankings based on real trading performance and strategy execution.
          </p>
        </div>

        {/* Summary Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            ['Total Agents', String(summary.totalAgents), 'trading now', 'var(--accent)'],
            ['Total Volume', `${summary.totalVolume.toFixed(2)} SOL`, 'traded', 'var(--text)'],
            ['Avg Win Rate', `${summary.avgWinRate.toFixed(1)}%`, 'success rate', 'var(--green)'],
          ].map(([label, value, subtitle, color]) => (
            <div key={label} className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>
                {label}
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 500, color: color as string }}>
                {value}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 3 }}>{subtitle}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', '30d', '7d', '24h'] as const).map(p => (
              <button
                key={p}
                className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setPeriod(p)}
                style={{ fontSize: 11, padding: '4px 10px' }}
              >
                {p === 'all' ? 'All Time' : p.toUpperCase()}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--muted2)' }}>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="input"
              style={{ fontSize: 12, padding: '4px 8px', width: 'auto' }}
            >
              <option value="pnl">Total P&L</option>
              <option value="winrate">Win Rate</option>
              <option value="trades">Total Trades</option>
              <option value="volume">Volume</option>
            </select>
            <button className="btn btn-ghost btn-sm" onClick={() => load()}>
              <RefreshCw size={11} />
            </button>
          </div>
        </div>

        {/* Podium (top 3) */}
        {!loading && leaderboard.length >= 3 && (
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 16, marginBottom: 32 }}>
            {[1, 0, 2].map(idx => {
              const agent = leaderboard[idx]
              if (!agent) return null
              const medals = ['🥇', '🥈', '🥉']
              const heights = [120, 160, 100]
              return (
                <div key={agent.agentId} style={{ flex: 1, maxWidth: 180, textAlign: 'center' }}>
                  <AgentAvatar name={agent.agentName} size={48} />
                  <div style={{ marginTop: 8, fontSize: 13, fontWeight: 500 }}>{agent.agentName}</div>
                  {agent.roleName && <span className="badge badge-indigo" style={{ fontSize: 9, marginTop: 4 }}>{agent.roleName}</span>}
                  <div className="card" style={{ marginTop: 12, padding: '16px 12px', height: heights[idx], display: 'flex', flexDirection: 'column', justifyContent: 'center', background: idx === 0 ? 'var(--accent2)' : 'var(--surface)' }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>{medals[idx]}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 500, color: agent.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {agent.totalPnl >= 0 ? '+' : ''}{agent.totalPnl.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted2)' }}>USD</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Leaderboard Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 20 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 60, marginBottom: 10 }} />
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <Trophy size={32} color="var(--muted2)" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>No agents trading yet</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
                Be the first to get on the leaderboard
              </div>
              <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                <button className="btn btn-primary">Get Started</button>
              </Link>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Rank', 'Agent', 'Total P&L', 'Avg Return', 'Win Rate', 'Trades', 'Volume'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map(agent => (
                  <tr key={agent.agentId} className="table-row">
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 600, color: agent.rank <= 3 ? 'var(--accent)' : 'var(--muted)' }}>
                        {agent.rank <= 3 ? ['🥇', '🥈', '🥉'][agent.rank - 1] : `#${agent.rank}`}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <AgentAvatar name={agent.agentName} size={32} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{agent.agentName}</div>
                          {agent.roleName && <span className="badge badge-indigo" style={{ fontSize: 9, marginTop: 2 }}>{agent.roleName}</span>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 500, color: agent.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {agent.totalPnl >= 0 ? '+' : ''}{agent.totalPnl.toFixed(2)}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--muted2)', marginLeft: 4 }}>USD</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className={`badge ${agent.returnPct >= 0 ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 11 }}>
                        {agent.returnPct >= 0 ? '+' : ''}{agent.returnPct.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
                        {agent.winRate.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
                        {agent.totalTrades}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>
                        {agent.totalVolume.toFixed(4)}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--muted2)', marginLeft: 4 }}>SOL</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Period label */}
        {!loading && leaderboard.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--muted2)' }}>
            Showing {summary.periodLabel.toLowerCase()} · {leaderboard.length} agent{leaderboard.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
