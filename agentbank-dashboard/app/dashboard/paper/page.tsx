'use client'
import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/lib/store'
import { Shell } from '@/components/ui/Shell'
import { getAgents, Agent } from '@/lib/api'
import { TrendingUp, TrendingDown, RefreshCw, FlaskConical, ExternalLink } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1'

interface PaperTrade {
  id:            string
  agentId:       string
  agentName?:    string
  tokenSymbol:   string
  side:          'buy' | 'sell'
  amountToken:   number
  amountSol:     number
  priceUsd:      number
  status:        'open' | 'closed' | 'cancelled'
  closePriceUsd?: number
  pnlUsd?:       number
  pnlPct?:       number
  currentPrice?: number
  unrealizedPnl?: number
  unrealizedPct?: number
  memo?:         string
  openedAt:      string
  closedAt?:     string
}

interface Portfolio {
  paperMode:    boolean
  paperBalance: number
  openTrades:   PaperTrade[]
  closedTrades: PaperTrade[]
  stats: {
    totalTrades:        number
    openTrades:         number
    closedTrades:       number
    winCount:           number
    lossCount:          number
    winRate:            string
    totalRealizedPnl:   string
    totalUnrealizedPnl: string
    totalPnl:           string
  }
}

interface LivePrice {
  usd:       number
  sol:       number
  change24h: number
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)    return `${s}s ago`
  if (s < 3600)  return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

function PnlBadge({ value, pct }: { value?: number; pct?: number }) {
  if (value === undefined) return null
  const positive = value >= 0
  return (
    <span className={`badge ${positive ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 11 }}>
      {positive ? '+' : ''}{value.toFixed(4)} USD ({positive ? '+' : ''}{pct?.toFixed(2)}%)
    </span>
  )
}

export default function PaperTradingPage() {
  const { apiKey } = useApp()
  const [agents, setAgents]         = useState<Agent[]>([])
  const [selectedAgent, setAgent]   = useState<string>('')
  const [portfolio, setPortfolio]   = useState<Portfolio | null>(null)
  const [prices, setPrices]         = useState<Record<string, LivePrice>>({})
  const [loading, setLoading]       = useState(false)
  const [allTrades, setAllTrades]   = useState<PaperTrade[]>([])
  const [enablingFor, setEnabling]  = useState<string | null>(null)

  const SYMBOLS = ['SOL','BTC','ETH','JUP','BONK','WIF','PYTH','RAY']

  // Load agents
  useEffect(() => {
    if (!apiKey) return
    fetch(`${API}/operators/agents`, { headers: { 'x-api-key': apiKey } })
      .then(r => r.json()).then(d => {
        setAgents(d.agents || [])
        const paper = (d.agents || []).find((a: any) => a.paperMode)
        if (paper) setAgent(paper.id)
      })
  }, [apiKey])

  // Load live prices
  const loadPrices = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/prices?symbols=${SYMBOLS.join(',')}`)
      const data = await res.json()
      setPrices(data.prices || {})
    } catch { /* silent */ }
  }, [])

  // Load portfolio for selected agent
  const loadPortfolio = useCallback(async () => {
    if (!selectedAgent || !apiKey) return
    setLoading(true)
    try {
      const agent = agents.find(a => a.id === selectedAgent)
      if (!agent) return
      // Use operator endpoint to get all trades
      const res  = await fetch(`${API}/operators/paper/trades`, { headers: { 'x-api-key': apiKey } })
      const data = await res.json()
      const myTrades = (data.trades || []).filter((t: any) => t.agentId === selectedAgent)
      setAllTrades(myTrades)

      // Calculate stats
      const open   = myTrades.filter((t: any) => t.status === 'open')
      const closed = myTrades.filter((t: any) => t.status === 'closed')
      const wins   = closed.filter((t: any) => (t.pnlUsd || 0) > 0)
      const totalPnl = closed.reduce((s: number, t: any) => s + (t.pnlUsd || 0), 0)
      setPortfolio({
        paperMode:    (agent as any).paperMode || false,
        paperBalance: (agent as any).paperBalance || 100,
        openTrades:   open,
        closedTrades: closed,
        stats: {
          totalTrades: myTrades.length,
          openTrades:  open.length,
          closedTrades: closed.length,
          winCount:    wins.length,
          lossCount:   closed.length - wins.length,
          winRate:     closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(1) : '0',
          totalRealizedPnl:   totalPnl.toFixed(4),
          totalUnrealizedPnl: '0',
          totalPnl:           totalPnl.toFixed(4),
        }
      })
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [selectedAgent, apiKey, agents])

  useEffect(() => { loadPrices(); const i = setInterval(loadPrices, 30_000); return () => clearInterval(i) }, [loadPrices])
  useEffect(() => { loadPortfolio() }, [loadPortfolio])

  async function togglePaperMode(agentId: string, enabled: boolean) {
    setEnabling(agentId)
    try {
      await fetch(`${API}/operators/agents/${agentId}/paper-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ enabled, initialBalance: 100 }),
      })
      // Refresh agents
      const res  = await fetch(`${API}/operators/agents`, { headers: { 'x-api-key': apiKey } })
      const data = await res.json()
      setAgents(data.agents || [])
      if (enabled) setAgent(agentId)
    } catch { /* silent */ }
    finally { setEnabling(null) }
  }

  const paperAgents = agents.filter(a => (a as any).paperMode)

  return (
    <Shell>
      <div style={{ padding: '32px 36px', maxWidth: 1080 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 className="page-title">Paper Trading</h1>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              Simulated trades with real market prices — no real money at risk
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { loadPrices(); loadPortfolio() }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {/* Live prices ticker */}
        <div className="card" style={{ padding: '12px 18px', marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 20, overflowX: 'auto', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase' as const, letterSpacing: '0.07em', flexShrink: 0 }}>Live Prices</span>
            {SYMBOLS.map(sym => {
              const p = prices[sym]
              if (!p) return null
              const pos = p.change24h >= 0
              return (
                <div key={sym} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{sym}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>${p.usd.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                  <span style={{ fontSize: 10, color: pos ? 'var(--green)' : 'var(--red)' }}>
                    {pos ? '▲' : '▼'} {Math.abs(p.change24h).toFixed(2)}%
                  </span>
                </div>
              )
            })}
            {Object.keys(prices).length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Loading prices from CoinGecko...</span>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
          {/* Left — agent list + enable paper mode */}
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 10 }}>Agents</div>
            {agents.map(agent => {
              const isPaper   = (agent as any).paperMode
              const balance   = (agent as any).paperBalance || 0
              const isSelected = agent.id === selectedAgent
              return (
                <div key={agent.id} onClick={() => isPaper && setAgent(agent.id)} style={{
                  background: isSelected ? 'var(--accent3)' : 'var(--surface)',
                  border: `1px solid ${isSelected ? 'rgba(200,240,96,0.3)' : 'var(--border)'}`,
                  borderRadius: 10, padding: '12px 14px', marginBottom: 8,
                  cursor: isPaper ? 'pointer' : 'default', transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{agent.name}</span>
                    {isPaper && <span className="badge badge-accent" style={{ fontSize: 9 }}>paper</span>}
                  </div>
                  {isPaper && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
                      {balance.toFixed(4)} {agent.chain === 'base' ? 'ETH' : 'SOL'} virtual
                    </div>
                  )}
                  <button
                    className={`btn btn-sm ${isPaper ? 'btn-danger' : 'btn-ghost'}`}
                    style={{ width: '100%', justifyContent: 'center', fontSize: 11 }}
                    onClick={e => { e.stopPropagation(); togglePaperMode(agent.id, !isPaper) }}
                    disabled={enablingFor === agent.id}
                  >
                    <FlaskConical size={10} />
                    {enablingFor === agent.id ? 'Saving...' : isPaper ? 'Disable' : 'Enable Paper Mode'}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Right — portfolio */}
          <div>
            {!selectedAgent || !portfolio ? (
              <div className="card" style={{ padding: 48, textAlign: 'center' }}>
                <FlaskConical size={28} color="var(--muted2)" style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>No agent selected</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Enable paper mode on an agent to start simulated trading
                </div>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
                  {[
                    ['Virtual Balance', `${portfolio.paperBalance.toFixed(4)} ${agents.find(a => a.id === selectedAgent)?.chain === 'base' ? 'ETH' : 'SOL'}`, 'var(--text)'],
                    ['Total P&L', `${Number(portfolio.stats.totalPnl) >= 0 ? '+' : ''}${portfolio.stats.totalPnl} USD`, Number(portfolio.stats.totalPnl) >= 0 ? 'var(--green)' : 'var(--red)'],
                    ['Win Rate', `${portfolio.stats.winRate}%`, 'var(--accent)'],
                    ['Total Trades', String(portfolio.stats.totalTrades), 'var(--text)'],
                  ].map(([l, v, c]) => (
                    <div key={l} className="card" style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 5 }}>{l}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 500, color: c as string }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Open positions */}
                {portfolio.openTrades.length > 0 && (
                  <div className="card" style={{ marginBottom: 14 }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="live-dot" style={{ width: 5, height: 5 }} />
                      Open Positions ({portfolio.openTrades.length})
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Token','Side','Amount','Entry','Current','Unrealized P&L','Opened'].map(h => (
                            <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {portfolio.openTrades.map(t => (
                          <tr key={t.id} className="table-row">
                            <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>{t.tokenSymbol}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span className={`badge ${t.side === 'buy' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10 }}>{t.side}</span>
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--mono)' }}>{Number(t.amountToken).toFixed(4)}</td>
                            <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--mono)' }}>${t.priceUsd.toFixed(4)}</td>
                            <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--mono)' }}>
                              ${(t.currentPrice || t.priceUsd).toFixed(4)}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <PnlBadge value={t.unrealizedPnl} pct={t.unrealizedPct} />
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--muted2)' }}>{timeAgo(t.openedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Trade history */}
                <div className="card">
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 500 }}>
                    Trade History ({portfolio.closedTrades.length})
                  </div>
                  {portfolio.closedTrades.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                      No closed trades yet. Agents will trade autonomously once they discover paper mode.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Token','Side','Amount','Entry','Exit','P&L','Memo','Time'].map(h => (
                            <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {portfolio.closedTrades.map(t => (
                          <tr key={t.id} className="table-row">
                            <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>{t.tokenSymbol}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span className={`badge ${t.side === 'buy' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10 }}>{t.side}</span>
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--mono)' }}>{Number(t.amountToken).toFixed(4)}</td>
                            <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--mono)' }}>${t.priceUsd.toFixed(4)}</td>
                            <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--mono)' }}>${(t.closePriceUsd || 0).toFixed(4)}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <PnlBadge value={t.pnlUsd} pct={t.pnlPct} />
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.memo}>{t.memo || '—'}</td>
                            <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--muted2)' }}>{timeAgo(t.openedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Shell>
  )
}
