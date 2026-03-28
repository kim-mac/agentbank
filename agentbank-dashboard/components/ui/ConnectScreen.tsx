'use client'
import { useState } from 'react'
import { useApp } from '@/lib/store'
import { getAgents, registerOperator } from '@/lib/api'
import { ArrowRight, Loader } from 'lucide-react'

const LogoMark = () => (
  <div style={{
    width: 44, height: 44, background: 'var(--accent)', borderRadius: 12,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <svg viewBox="0 0 16 16" fill="none" width={20} height={20}>
      <rect x="2" y="2" width="5" height="5" rx="1.5" fill="#080809"/>
      <rect x="9" y="2" width="5" height="5" rx="1.5" fill="#080809"/>
      <rect x="2" y="9" width="5" height="5" rx="1.5" fill="#080809"/>
      <rect x="9" y="9" width="5" height="5" rx="1.5" fill="#080809" opacity="0.4"/>
    </svg>
  </div>
)

export function ConnectScreen() {
  const { setApiKey } = useApp()
  const [key, setKey]         = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [tab, setTab]         = useState<'connect' | 'register'>('connect')
  const [email, setEmail]     = useState('')
  const [org, setOrg]         = useState('')
  const [regResult, setRegResult] = useState<any>(null)

  async function connect() {
    if (!key.trim()) return
    setLoading(true); setError('')
    try {
      await getAgents(key.trim())
      setApiKey(key.trim())
    } catch {
      setError('Invalid API key or backend not reachable')
    } finally { setLoading(false) }
  }

  async function register() {
    if (!email || !org) return
    setLoading(true); setError('')
    try {
      const res = await registerOperator(email, org)
      setRegResult(res)
    } catch (e: any) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: 20,
      position: 'relative',
    }}>
      {/* Grid background */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 100%)',
      }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', animation: 'fadeUp 0.5s ease' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <LogoMark />
          <div style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, color: 'var(--text)', marginTop: 12, letterSpacing: '-0.3px' }}>
            AgentBank
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            Non-custodial wallets for AI agents
          </div>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 28 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: 3, marginBottom: 24 }}>
            {(['connect', 'register'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '7px 12px', borderRadius: 7, border: 'none',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--sans)',
                background: tab === t ? 'var(--surface2)' : 'transparent',
                color: tab === t ? 'var(--text)' : 'var(--muted)',
                boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                transition: 'all 0.15s',
              }}>
                {t === 'connect' ? 'Sign in' : 'Register'}
              </button>
            ))}
          </div>

          {tab === 'connect' ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Operator API Key
                </label>
                <input
                  className="input"
                  value={key}
                  onChange={e => setKey(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && connect()}
                  placeholder="op_xxxxxxxxxxxxxxxx"
                  type="password"
                />
                <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 5 }}>
                  From your registration or agent's messageForHuman
                </div>
              </div>
              {error && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>{error}</div>}
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={connect} disabled={loading}>
                {loading
                  ? <Loader size={14} />
                  : <><span>Connect Dashboard</span><ArrowRight size={14}/></>
                }
              </button>
            </>
          ) : (
            <>
              {!regResult ? (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</label>
                    <input className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Organization</label>
                    <input className="input" value={org} onChange={e => setOrg(e.target.value)} placeholder="My AI Lab" />
                  </div>
                  {error && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>{error}</div>}
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={register} disabled={loading}>
                    {loading ? <Loader size={14} /> : 'Create Account'}
                  </button>
                </>
              ) : (
                <div style={{ background: 'var(--green-bg)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontWeight: 500, color: 'var(--green)', marginBottom: 8, fontSize: 13 }}>Account created</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Your API key — save this:</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, background: 'var(--surface2)', padding: '8px 10px', borderRadius: 7, marginBottom: 12, wordBreak: 'break-all', color: 'var(--text)' }}>
                    {regResult.apiKey}
                  </div>
                  <button className="btn btn-success" style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => { setKey(regResult.apiKey); setTab('connect') }}>
                    Use this key →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer note */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--muted2)' }}>
          Don't have an account?{' '}
          <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setTab('register')}>
            Register →
          </span>
        </div>
      </div>

      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  )
}
