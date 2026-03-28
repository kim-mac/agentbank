'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { updatePolicy } from '@/lib/api'
import { Clock, TrendingDown, AlertTriangle, MapPin, Tag, ChevronDown, ChevronUp, Save, X, MessageSquare } from 'lucide-react'

interface Policy {
  dailyLimit:           number
  txLimit:              number
  requireApprovalAbove: number
  whitelistedAddresses: string[]
  allowedChains:        string[]
  killSwitch:           boolean
  timeRule?:            { enabled: boolean; startHour: number; endHour: number; blockWeekends: boolean }
  balanceRule?:         { enabled: boolean; minBalance: number }
  spendThresholdRule?:  { enabled: boolean; approvalThreshold: number }
  perAddressRule?:      { enabled: boolean; maxPerAddress: number; maxTxPerHour: number }
  categoryRule?:        { enabled: boolean; allowedCategories: string[]; blockUnknown: boolean; categoryAddresses: Record<string, string[]> }
  messagingRule?:       { allowMessages: boolean; canActOnMessages: boolean; trustedSenders: string[] }
}

interface Props {
  agentId:  string
  agentName: string
  apiKey:   string
  policy:   Policy
  onSave:   () => void
  onClose:  () => void
}

const CATEGORIES = ['dex', 'prediction_market', 'api', 'nft', 'lending', 'bridge']

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 36, height: 20, borderRadius: 99, cursor: 'pointer',
        background: value ? 'var(--accent)' : 'var(--surface3)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        border: '1px solid var(--border)',
      }}
    >
      <div style={{
        position: 'absolute', top: 2,
        left: value ? 18 : 2,
        width: 14, height: 14, borderRadius: 99,
        background: value ? '#080809' : 'var(--muted)',
        transition: 'left 0.2s',
      }} />
    </div>
  )
}

function RuleSection({ icon: Icon, title, subtitle, enabled, onToggle, children }: {
  icon: any; title: string; subtitle: string;
  enabled: boolean; onToggle: () => void; children: React.ReactNode
}) {
  const [open, setOpen] = useState(enabled)
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
        background: enabled ? 'var(--accent3)' : 'var(--surface)',
        borderBottom: open ? '1px solid var(--border)' : 'none',
        transition: 'background 0.2s',
      }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: enabled ? 'var(--accent2)' : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={14} color={enabled ? 'var(--accent)' : 'var(--muted)'} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{title}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{subtitle}</div>
        </div>
        <Toggle value={enabled} onChange={onToggle} />
        <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      {/* Body */}
      {open && (
        <div style={{ padding: '16px', background: 'var(--surface)', opacity: enabled ? 1 : 0.5, pointerEvents: enabled ? 'auto' : 'none' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text)' }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{hint}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

export function PolicyBuilder({ agentId, agentName, apiKey, policy, onSave, onClose }: Props) {
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  // Basic policy
  const [dailyLimit,  setDailyLimit]  = useState(String(policy.dailyLimit))
  const [txLimit,     setTxLimit]     = useState(String(policy.txLimit))
  const [approvalAbv, setApprovalAbv] = useState(String(policy.requireApprovalAbove))
  const [whitelist,   setWhitelist]   = useState(policy.whitelistedAddresses.join('\n'))

  // Time rule
  const [timeEnabled,    setTimeEnabled]    = useState(policy.timeRule?.enabled || false)
  const [startHour,      setStartHour]      = useState(String(policy.timeRule?.startHour ?? 9))
  const [endHour,        setEndHour]        = useState(String(policy.timeRule?.endHour ?? 17))
  const [blockWeekends,  setBlockWeekends]  = useState(policy.timeRule?.blockWeekends || false)

  // Balance rule
  const [balEnabled,  setBalEnabled]  = useState(policy.balanceRule?.enabled || false)
  const [minBalance,  setMinBalance]  = useState(String(policy.balanceRule?.minBalance ?? 0.1))

  // Spend threshold rule
  const [spendEnabled,   setSpendEnabled]   = useState(policy.spendThresholdRule?.enabled || false)
  const [spendThreshold, setSpendThreshold] = useState(String(policy.spendThresholdRule?.approvalThreshold ?? 80))

  // Per-address rule
  const [addrEnabled,    setAddrEnabled]    = useState(policy.perAddressRule?.enabled || false)
  const [maxPerAddr,     setMaxPerAddr]     = useState(String(policy.perAddressRule?.maxPerAddress ?? 0.5))
  const [maxTxPerHour,   setMaxTxPerHour]   = useState(String(policy.perAddressRule?.maxTxPerHour ?? 3))

  // Category rule
  const [catEnabled,     setCatEnabled]     = useState(policy.categoryRule?.enabled || false)
  const [blockUnknown,   setBlockUnknown]   = useState(policy.categoryRule?.blockUnknown || false)
  const [allowedCats,    setAllowedCats]    = useState<string[]>(policy.categoryRule?.allowedCategories || [])
  const [catAddresses,   setCatAddresses]   = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(policy.categoryRule?.categoryAddresses || {}).map(([k, v]) => [k, (v as string[]).join('\n')]))
  )
  const [editingCat,     setEditingCat]     = useState<string | null>(null)

  // Messaging rule
  const [allowMessages,     setAllowMessages]     = useState(policy.messagingRule?.allowMessages     ?? true)
  const [canActOnMessages,  setCanActOnMessages]  = useState(policy.messagingRule?.canActOnMessages  ?? false)
  const [trustedSenders,    setTrustedSenders]    = useState(policy.messagingRule?.trustedSenders?.join('\n') ?? '')

  async function save() {
    setSaving(true); setError('')
    try {
      await updatePolicy(apiKey, agentId, {
        dailyLimit:           +dailyLimit,
        txLimit:              +txLimit,
        requireApprovalAbove: +approvalAbv,
        whitelistedAddresses: whitelist.split('\n').map(s => s.trim()).filter(Boolean),
        timeRule: {
          enabled: timeEnabled, startHour: +startHour,
          endHour: +endHour, blockWeekends,
        },
        balanceRule:       { enabled: balEnabled,   minBalance: +minBalance },
        spendThresholdRule: { enabled: spendEnabled, approvalThreshold: +spendThreshold },
        perAddressRule:    { enabled: addrEnabled,  maxPerAddress: +maxPerAddr, maxTxPerHour: +maxTxPerHour },
        messagingRule: {
          allowMessages:    allowMessages,
          canActOnMessages: canActOnMessages,
          trustedSenders:   trustedSenders.split('\n').map((s: string) => s.trim()).filter(Boolean),
        },
        categoryRule: {
          enabled: catEnabled, allowedCategories: allowedCats, blockUnknown,
          categoryAddresses: Object.fromEntries(
            Object.entries(catAddresses).map(([k, v]) => [k, v.split('\n').map((s: string) => s.trim()).filter(Boolean)])
          ),
        },
      })
      onSave()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const inputStyle = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--mono)', outline: 'none', width: 100, textAlign: 'right' as const }

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400 }}>Policy Builder</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{agentName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Basic policy */}
          <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Basic Limits</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 16, background: 'var(--surface)' }}>
            <FieldRow label="Daily limit" hint="Max SOL per day">
              <input style={inputStyle} type="number" value={dailyLimit} onChange={e => setDailyLimit(e.target.value)} step="0.1" />
            </FieldRow>
            <FieldRow label="Per-tx limit" hint="Max SOL per transaction">
              <input style={inputStyle} type="number" value={txLimit} onChange={e => setTxLimit(e.target.value)} step="0.01" />
            </FieldRow>
            <FieldRow label="Approval above" hint="Require human sign-off">
              <input style={inputStyle} type="number" value={approvalAbv} onChange={e => setApprovalAbv(e.target.value)} step="0.1" />
            </FieldRow>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 5 }}>Whitelisted addresses</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>One address per line. Leave empty to allow all.</div>
              <textarea
                value={whitelist}
                onChange={e => setWhitelist(e.target.value)}
                placeholder="address1&#10;address2"
                style={{ ...inputStyle, width: '100%', textAlign: 'left', height: 72, resize: 'vertical', fontFamily: 'var(--mono)', fontSize: 11 }}
              />
            </div>
          </div>

          {/* Advanced rules */}
          <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Advanced Rules</div>

          {/* Time rule */}
          <RuleSection icon={Clock} title="Time-based rules" subtitle="Only allow transactions during specific hours" enabled={timeEnabled} onToggle={() => setTimeEnabled(!timeEnabled)}>
            <FieldRow label="Start hour (UTC)" hint="0-23">
              <input style={inputStyle} type="number" min={0} max={23} value={startHour} onChange={e => setStartHour(e.target.value)} />
            </FieldRow>
            <FieldRow label="End hour (UTC)" hint="0-23">
              <input style={inputStyle} type="number" min={0} max={23} value={endHour} onChange={e => setEndHour(e.target.value)} />
            </FieldRow>
            <FieldRow label="Block weekends" hint="No transactions Sat-Sun (UTC)">
              <Toggle value={blockWeekends} onChange={setBlockWeekends} />
            </FieldRow>
            <div style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface2)', padding: '8px 10px', borderRadius: 7, marginTop: 4 }}>
              Currently: {new Date().toUTCString().split(' ')[0]} {new Date().getUTCHours()}:00 UTC
            </div>
          </RuleSection>

          {/* Balance rule */}
          <RuleSection icon={TrendingDown} title="Balance threshold" subtitle="Auto-pause agent if wallet runs low" enabled={balEnabled} onToggle={() => setBalEnabled(!balEnabled)}>
            <FieldRow label="Minimum balance (SOL)" hint="Agent pauses if balance drops below this">
              <input style={inputStyle} type="number" value={minBalance} onChange={e => setMinBalance(e.target.value)} step="0.01" />
            </FieldRow>
            <div style={{ fontSize: 11, color: 'var(--amber)', background: 'var(--amber-bg)', padding: '8px 10px', borderRadius: 7, marginTop: 4 }}>
              ⚡ Agent will be automatically paused and you will need to manually resume it from the dashboard.
            </div>
          </RuleSection>

          {/* Spend threshold rule */}
          <RuleSection icon={AlertTriangle} title="Spend threshold" subtitle="Require approval when approaching daily limit" enabled={spendEnabled} onToggle={() => setSpendEnabled(!spendEnabled)}>
            <FieldRow label="Approval threshold" hint="% of daily limit that triggers approval">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input style={{ ...inputStyle, width: 70 }} type="number" min={1} max={99} value={spendThreshold} onChange={e => setSpendThreshold(e.target.value)} />
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>%</span>
              </div>
            </FieldRow>
            <div style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface2)', padding: '8px 10px', borderRadius: 7, marginTop: 4 }}>
              Transactions will need approval when cumulative daily spend exceeds {spendThreshold}% of the {dailyLimit} SOL daily limit ({(+dailyLimit * +spendThreshold / 100).toFixed(3)} SOL)
            </div>
          </RuleSection>

          {/* Per-address rule */}
          <RuleSection icon={MapPin} title="Per-address limits" subtitle="Limit how much can be sent to a single address" enabled={addrEnabled} onToggle={() => setAddrEnabled(!addrEnabled)}>
            <FieldRow label="Max per address (SOL/day)" hint="Daily limit to any single address">
              <input style={inputStyle} type="number" value={maxPerAddr} onChange={e => setMaxPerAddr(e.target.value)} step="0.01" />
            </FieldRow>
            <FieldRow label="Max tx/hour per address" hint="Frequency limit per address">
              <input style={{ ...inputStyle, width: 70 }} type="number" value={maxTxPerHour} onChange={e => setMaxTxPerHour(e.target.value)} min={1} />
            </FieldRow>
          </RuleSection>

          {/* Category rule */}
          <RuleSection icon={Tag} title="Category rules" subtitle="Only allow transactions to known address categories" enabled={catEnabled} onToggle={() => setCatEnabled(!catEnabled)}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>Allowed categories:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setAllowedCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}
                    style={{
                      padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', border: 'none', fontFamily: 'var(--sans)',
                      background: allowedCats.includes(cat) ? 'var(--accent2)' : 'var(--surface2)',
                      color: allowedCats.includes(cat) ? 'var(--accent)' : 'var(--muted)',
                    }}>
                    {cat.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <FieldRow label="Block unknown addresses" hint="Reject txs to uncategorized addresses">
              <Toggle value={blockUnknown} onChange={setBlockUnknown} />
            </FieldRow>

            {/* Category address lists */}
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, marginTop: 4 }}>Category address lists:</div>
            {allowedCats.map(cat => (
              <div key={cat} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="badge badge-accent" style={{ fontSize: 10 }}>{cat.replace('_', ' ')}</span>
                  <button onClick={() => setEditingCat(editingCat === cat ? null : cat)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--muted)' }}>
                    {editingCat === cat ? 'Done' : 'Edit addresses'}
                  </button>
                </div>
                {editingCat === cat && (
                  <textarea
                    value={catAddresses[cat] || ''}
                    onChange={e => setCatAddresses(prev => ({ ...prev, [cat]: e.target.value }))}
                    placeholder={`One ${cat} address per line`}
                    style={{ ...inputStyle, width: '100%', textAlign: 'left', height: 64, resize: 'vertical', fontFamily: 'var(--mono)', fontSize: 10 }}
                  />
                )}
                {!editingCat || editingCat !== cat ? (
                  <div style={{ fontSize: 10, color: 'var(--muted2)' }}>
                    {(catAddresses[cat] || '').split('\n').filter(Boolean).length} addresses configured
                  </div>
                ) : null}
              </div>
            ))}
          </RuleSection>

          {/* Messaging rule */}
          <RuleSection icon={MessageSquare} title="Messaging settings" subtitle="Control how this agent sends and receives messages" enabled={allowMessages} onToggle={() => setAllowMessages(!allowMessages)}>
            <FieldRow label="Allow incoming messages" hint="Agent can receive messages from other agents">
              <Toggle value={allowMessages} onChange={setAllowMessages} />
            </FieldRow>
            <FieldRow label="Can act on messages" hint="Agent can execute transactions based on action_request messages">
              <Toggle value={canActOnMessages} onChange={setCanActOnMessages} />
            </FieldRow>
            {canActOnMessages && (
              <>
                <div style={{ background: 'var(--amber-bg)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontSize: 11, color: 'var(--amber)', lineHeight: 1.5 }}>
                  ⚡ This agent will execute transactions when it receives an action_request. The message becomes the transaction memo.
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text)', marginBottom: 5, display: 'block' }}>Trusted senders (optional)</label>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Only act on messages from these agent IDs. Leave empty to trust all.</div>
                  <textarea
                    value={trustedSenders}
                    onChange={e => setTrustedSenders(e.target.value)}
                    placeholder="agent-id-1&#10;agent-id-2"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', color: 'var(--text)', fontSize: 11, fontFamily: 'var(--mono)', outline: 'none', width: '100%', height: 64, resize: 'vertical' as const }}
                  />
                </div>
              </>
            )}
          </RuleSection>

        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {error && <div style={{ fontSize: 12, color: 'var(--red)' }}>{error}</div>}
          {!error && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Changes take effect immediately</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Save size={12} /> {saving ? 'Saving...' : 'Save Policy'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
