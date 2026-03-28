'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { updateAgentRole } from '@/lib/api'
import { X, Save, Users, FileText } from 'lucide-react'

const PRESET_ROLES = [
  { name: 'research',   label: 'Research',   desc: 'Analyzes data and finds opportunities',      emoji: '🔬' },
  { name: 'news',       label: 'News',        desc: 'Monitors news and market events',             emoji: '📰' },
  { name: 'risk',       label: 'Risk',        desc: 'Evaluates risk before trades',               emoji: '🛡️' },
  { name: 'trading',    label: 'Trading',     desc: 'Makes trading decisions',                    emoji: '📈' },
  { name: 'execution',  label: 'Execution',   desc: 'Executes transactions — the only spender',  emoji: '⚡' },
  { name: 'custom',     label: 'Custom',      desc: 'Define your own role',                       emoji: '✦' },
]

const ROLE_DOCUMENTS: Record<string, string> = {
  research: `You are a research agent in a collaborative trading team.

Your responsibilities:
- Analyze market data, on-chain metrics, and technical indicators
- Post findings to the group when you identify significant patterns
- Respond to news from the news-agent with technical analysis
- Never execute transactions — only post analysis

When posting to the group:
- State your confidence level (e.g. "Confidence: 74%")
- Include key data points that support your analysis
- Tag your message type: [ANALYSIS] or [ALERT]`,

  news: `You are a news monitoring agent in a collaborative trading team.

Your responsibilities:
- Monitor market news, social sentiment, and macro events
- Post relevant news to the group immediately when found
- Summarize news concisely with potential market impact
- Never execute transactions — only post news summaries

When posting to the group:
- Rate the significance: [HIGH], [MEDIUM], [LOW]
- Include the source and timestamp
- State the potential market impact`,

  risk: `You are a risk management agent in a collaborative trading team.

Your responsibilities:
- Monitor portfolio exposure and daily spend limits
- Evaluate every proposed trade for risk
- Post risk assessments before the trading agent decides
- Veto trades that exceed risk parameters

When responding to trading proposals:
- Check current daily spend vs limit
- Assess position size relative to portfolio
- Post: [APPROVE: max X SOL] or [VETO: reason]
- Never execute transactions`,

  trading: `You are a trading decision agent in a collaborative trading team.

Your responsibilities:
- Read analysis from research-agent and news-agent
- Read risk assessments from risk-agent
- Make final trading decisions based on team input
- Post decisions as action_request messages targeting execution-agent

Decision format:
  ACTION: BUY/SELL [amount] [token] | Reason: [brief] | Confidence: [%]

Rules:
- Only decide after receiving risk approval
- Minimum confidence threshold: 65%
- Never execute transactions directly — route to execution-agent`,

  execution: `You are the execution agent in a collaborative trading team.

Your responsibilities:
- Execute transactions when authorized by trading-agent
- You are the ONLY agent that can spend money
- Verify authorization before every transaction

Before executing:
1. Confirm the message is from trading-agent (trusted sender)
2. Confirm risk-agent has approved in the group
3. Confirm amount is within daily limits
4. Execute via wallet.actOnMessage()
5. Post result to group: [EXECUTED: amount token | tx: hash]

If any check fails — post [BLOCKED: reason] and do not execute.`,
}

interface Props {
  agentId:      string
  agentName:    string
  apiKey:       string
  currentRole?: string
  currentDoc?:  string
  inGroup?:     boolean
  onSave:       () => void
  onClose:      () => void
}

export function RoleEditor({ agentId, agentName, apiKey, currentRole, currentDoc, inGroup, onSave, onClose }: Props) {
  const [mounted, setMounted]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [selectedRole, setRole]   = useState(currentRole || '')
  const [customRole, setCustom]   = useState(currentRole && !PRESET_ROLES.find(r => r.name === currentRole && r.name !== 'custom') ? currentRole : '')
  const [roleDoc, setRoleDoc]      = useState(currentDoc || '')
  const [groupEnabled, setGroup]  = useState(inGroup || false)
  const [tab, setTab]             = useState<'role' | 'document'>('role')

  useEffect(() => { setMounted(true) }, [])

  function selectPreset(name: string) {
    setRole(name)
    if (name !== 'custom' && ROLE_DOCUMENTS[name]) {
      setRoleDoc(ROLE_DOCUMENTS[name])
    }
  }

  async function save() {
    setSaving(true); setError('')
    try {
      const finalRole = selectedRole === 'custom' ? customRole : selectedRole
      await updateAgentRole(apiKey, agentId, {
        roleName:     finalRole || undefined,
        roleDocument: roleDoc  || undefined,
        inGroup:      groupEnabled,
      })
      onSave()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (!mounted) return null

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 540, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400 }}>Role Editor</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{agentName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.04)', margin: '14px 24px 0', borderRadius: 9, padding: 3 }}>
          {([['role', 'Role', Users], ['document', 'Role Document', FileText]] as [string, string, any][]).map(([val, label, Icon]) => (
            <button key={val} onClick={() => setTab(val as any)} style={{
              flex: 1, padding: '7px 12px', borderRadius: 7, border: 'none',
              fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--sans)',
              background: tab === val ? 'var(--surface2)' : 'transparent',
              color: tab === val ? 'var(--text)' : 'var(--muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.15s',
            }}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {tab === 'role' ? (
            <>
              {/* Group toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: groupEnabled ? 'var(--accent3)' : 'var(--surface2)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>Group collaboration</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    Agent joins the operator's private group channel
                  </div>
                </div>
                <div onClick={() => setGroup(!groupEnabled)} style={{
                  width: 36, height: 20, borderRadius: 99, cursor: 'pointer',
                  background: groupEnabled ? 'var(--accent)' : 'var(--surface3)',
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  border: '1px solid var(--border)',
                }}>
                  <div style={{
                    position: 'absolute', top: 2,
                    left: groupEnabled ? 18 : 2,
                    width: 14, height: 14, borderRadius: 99,
                    background: groupEnabled ? '#080809' : 'var(--muted)',
                    transition: 'left 0.2s',
                  }} />
                </div>
              </div>

              {/* Role presets */}
              <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 10 }}>Select Role</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {PRESET_ROLES.map(role => {
                  const active = selectedRole === role.name
                  return (
                    <div key={role.name} onClick={() => selectPreset(role.name)} style={{
                      padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'var(--accent3)' : 'var(--surface2)',
                      transition: 'all 0.15s',
                    }}>
                      <div style={{ fontSize: 18, marginBottom: 5 }}>{role.emoji}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: active ? 'var(--accent)' : 'var(--text)' }}>{role.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>{role.desc}</div>
                    </div>
                  )
                })}
              </div>

              {/* Custom role name */}
              {selectedRole === 'custom' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>Custom Role Name</label>
                  <input className="input" value={customRole} onChange={e => setCustom(e.target.value)} placeholder="e.g. sentiment-analyst" />
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>
                This document is read by the agent on startup. It defines its responsibilities, how it should behave in the group, and what actions it should take.
                {selectedRole && selectedRole !== 'custom' && (
                  <span style={{ color: 'var(--accent)', cursor: 'pointer', marginLeft: 6 }} onClick={() => setRoleDoc(ROLE_DOCUMENTS[selectedRole] || '')}>
                    Reset to {selectedRole} template →
                  </span>
                )}
              </div>
              <textarea
                className="input"
                style={{ minHeight: 320, resize: 'vertical' as const, fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.6 }}
                value={roleDoc}
                onChange={e => setRoleDoc(e.target.value)}
                placeholder="Describe this agent's role, responsibilities, and how it should behave in the group..."
              />
              <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 6 }}>
                {roleDoc.length} characters · Agent reads this via wallet.groupDirectory()
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {error
            ? <div style={{ fontSize: 12, color: 'var(--red)' }}>{error}</div>
            : <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {selectedRole && selectedRole !== 'custom' ? `Role: ${selectedRole}` : customRole ? `Role: ${customRole}` : 'No role assigned'}
                {groupEnabled ? ' · In group' : ' · Not in group'}
              </div>
          }
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Save size={12} /> {saving ? 'Saving...' : 'Save Role'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
