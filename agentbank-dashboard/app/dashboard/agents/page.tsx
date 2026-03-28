'use client'
import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/lib/store'
import { Shell } from '@/components/ui/Shell'
import { PolicyBuilder } from '@/components/ui/PolicyBuilder'
import { getAgents, createAgent, freezeAgent, deleteAgent, Agent } from '@/lib/api'
import { RoleEditor } from '@/components/ui/RoleEditor'
import { Plus, Lock, Unlock, PauseCircle, Zap, RefreshCw, Copy, Settings, Trash2, Users } from 'lucide-react'

function AgentCard({ agent, apiKey, onRefresh }: { agent: Agent; apiKey: string; onRefresh: () => void }) {
  const [loading, setLoading]       = useState(false)
  const [showPolicy, setShowPolicy] = useState(false)
  const [showRole, setShowRole]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  async function doDelete() {
    setLoading(true)
    try {
      await deleteAgent(apiKey, agent.id)
      onRefresh() // re-fetch agents list — deleted agent won't come back
    } catch (e: any) {
      setConfirmDelete(false)
    } finally { setLoading(false) }
  }

  const pct = agent.dailyLimit > 0 ? Math.min(100, (agent.todaySpend / agent.dailyLimit) * 100) : 0

  async function doFreeze(action: 'freeze'|'unfreeze'|'pause') {
    setLoading(true)
    try { await freezeAgent(apiKey, agent.id, action); onRefresh() } catch {}
    finally { setLoading(false) }
  }


  const statusColor = agent.status === 'active' ? 'var(--green)' : agent.status === 'paused' ? 'var(--amber)' : 'var(--red)'

  return (
    <div className="card animate-in" style={{ overflow: 'hidden' }}>
      <div style={{ height: 2, background: statusColor, opacity: 0.6 }} />
      <div style={{ padding: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
            <div className={`status-dot ${agent.status}`} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.description || 'No description'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
              {agent.roleName && <span className="badge badge-indigo" style={{ fontSize: 10 }}>{agent.roleName}</span>}
              {agent.inGroup  && <span className="badge badge-accent"  style={{ fontSize: 10 }}>group</span>}
              <span className={`badge ${agent.status === 'active' ? 'badge-green' : agent.status === 'paused' ? 'badge-amber' : 'badge-red'}`}>{agent.status}</span>
            </div>
        </div>

        {/* Wallet */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface2)', borderRadius: 8, padding: '7px 10px', marginBottom: 14 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>{agent.walletAddress.slice(0,16)}...{agent.walletAddress.slice(-6)}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <span className="badge badge-indigo" style={{ fontSize: 10 }}>{agent.chain}</span>
            <button onClick={() => navigator.clipboard.writeText(agent.walletAddress)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted2)', padding: 0 }}>
              <Copy size={11} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Balance</div>
            <div style={{ fontSize: 18, fontWeight: 500, fontFamily: 'var(--mono)', color: 'var(--text)' }}>{agent.balance.sol.toFixed(4)}</div>
            <div style={{ fontSize: 10, color: 'var(--muted2)' }}>SOL</div>
          </div>
          <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Today</div>
            <div style={{ fontSize: 18, fontWeight: 500, fontFamily: 'var(--mono)', color: 'var(--text)' }}>{agent.todaySpend.toFixed(4)}</div>
            <div style={{ fontSize: 10, color: 'var(--muted2)' }}>of {agent.dailyLimit} SOL</div>
          </div>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct > 80 ? 'var(--red)' : pct > 60 ? 'var(--amber)' : 'var(--accent)', borderRadius: 99, transition: 'width 0.5s' }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 4 }}>{pct.toFixed(0)}% of daily limit</div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Status Controls */}
          <div style={{ display: 'flex', gap: 6 }}>
            {agent.status !== 'frozen'
              ? <button className="btn btn-danger btn-sm" onClick={() => doFreeze('freeze')} disabled={loading}><Lock size={11} /> Freeze</button>
              : <button className="btn btn-success btn-sm" onClick={() => doFreeze('unfreeze')} disabled={loading}><Unlock size={11} /> Unfreeze</button>
            }
            {agent.status === 'active' && <button className="btn btn-ghost btn-sm" onClick={() => doFreeze('pause')} disabled={loading}><PauseCircle size={11} /> Pause</button>}
            {agent.status === 'paused' && <button className="btn btn-ghost btn-sm" onClick={() => doFreeze('unfreeze')} disabled={loading}><Zap size={11} /> Resume</button>}
          </div>

          {/* Management Controls */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setShowRole(true)}>
              <Users size={11} /> Role
            </button>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setShowPolicy(true)}>
              <Settings size={11} /> Policy
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)} disabled={loading} style={{ paddingLeft: 10, paddingRight: 10 }}>
              <Trash2 size={11} />
            </button>
          </div>
        </div>

        {/* Role Editor */}
        {showRole && (
          <RoleEditor
            agentId={agent.id}
            agentName={agent.name}
            apiKey={apiKey}
            currentRole={agent.roleName}
            currentDoc={agent.roleDocument}
            inGroup={agent.inGroup}
            onSave={() => { setShowRole(false); onRefresh() }}
            onClose={() => setShowRole(false)}
          />
        )}

        {/* Delete confirmation */}
        {confirmDelete && (
          <div style={{ marginTop: 12, background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--red)', marginBottom: 6 }}>Delete {agent.name}?</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
              This will invalidate the agent's API key immediately. Transaction history is preserved. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={doDelete} disabled={loading}>
                {loading ? 'Deleting...' : 'Yes, delete agent'}
              </button>
            </div>
          </div>
        )}

        {/* Advanced Policy Builder */}
        {showPolicy && (
          <PolicyBuilder
            agentId={agent.id}
            agentName={agent.name}
            apiKey={apiKey}
            policy={agent.policy as any}
            onSave={() => { setShowPolicy(false); onRefresh() }}
            onClose={() => setShowPolicy(false)}
          />
        )}
      </div>
    </div>
  )
}

export default function AgentsPage() {
  const { apiKey } = useApp()
  const [agents, setAgents]     = useState<Agent[]>([])
  const [loading, setLoading]   = useState(true)
  const [showNew, setShowNew]   = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError]       = useState('')
  const [form, setForm]         = useState({ name: '', description: '', walletAddress: '', chain: 'solana', dailyLimit: '1.0', txLimit: '0.1', approvalAbove: '0.5' })

  const load = useCallback(async () => {
    if (!apiKey) return
    try { const r = await getAgents(apiKey); setAgents(r.agents || []) } catch {} finally { setLoading(false) }
  }, [apiKey])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    if (!form.name || !form.walletAddress) { setError('Name and wallet address are required'); return }
    setCreating(true); setError('')
    try {
      await createAgent(apiKey, { name: form.name, description: form.description, walletAddress: form.walletAddress, chain: form.chain, policy: { dailyLimit: +form.dailyLimit, txLimit: +form.txLimit, requireApprovalAbove: +form.approvalAbove, whitelistedAddresses: [], allowedChains: [form.chain], killSwitch: false } })
      setShowNew(false)
      setForm({ name: '', description: '', walletAddress: '', chain: 'solana', dailyLimit: '1.0', txLimit: '0.1', approvalAbove: '0.5' })
      load()
    } catch (e: any) { setError(e.message) } finally { setCreating(false) }
  }

  return (
    <Shell>
      <div style={{ padding: '32px 36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h1 className="page-title">Agents</h1>
            <div className="page-sub">{agents.length} registered</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={12} /></button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowNew(!showNew)}><Plus size={13} /> New Agent</button>
          </div>
        </div>

        {showNew && (
          <div className="card animate-in" style={{ padding: 22, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16 }}>Register New Agent</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[['Name', 'name', 'trading-agent-01'], ['Description', 'description', 'Optional']].map(([l, k, p]) => (
                <div key={k}>
                  <label style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</label>
                  <input className="input" placeholder={p} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Wallet Address (public key)</label>
              <input className="input" placeholder="Solana public key" value={form.walletAddress} onChange={e => setForm(f => ({ ...f, walletAddress: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 12 }}>
              {[['Daily Limit (SOL)', 'dailyLimit'], ['TX Limit (SOL)', 'txLimit'], ['Approval Above (SOL)', 'approvalAbove']].map(([l, k]) => (
                <div key={k}>
                  <label style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</label>
                  <input className="input" type="number" step="0.1" value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
            {error && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 10 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowNew(false); setError('') }}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={creating}>{creating ? 'Creating...' : 'Create Agent'}</button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 280 }} />)}
          </div>
        ) : agents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 32, marginBottom: 12, opacity: 0.3 }}>◈</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>No agents yet</div>
            <div style={{ fontSize: 13 }}>Run <code style={{ fontFamily: 'var(--mono)', background: 'var(--surface2)', padding: '2px 6px', borderRadius: 4 }}>npm run setup</code> or use the form above</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
            {agents.map(agent => <AgentCard key={agent.id} agent={agent} apiKey={apiKey} onRefresh={load} />)}
          </div>
        )}
      </div>
    </Shell>
  )
}
