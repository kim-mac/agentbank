'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useApp } from '@/lib/store'
import { LayoutDashboard, Bot, CheckCircle, ArrowLeftRight, Sun, Moon, LogOut, MessageSquare, FlaskConical, CircleDollarSign } from 'lucide-react'

const nav = [
  { href: '/dashboard',              label: 'Overview',     icon: LayoutDashboard },
  { href: '/dashboard/agents',       label: 'Agents',       icon: Bot },
  { href: '/dashboard/approvals',    label: 'Approvals',    icon: CheckCircle },
  { href: '/dashboard/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/dashboard/payments',     label: 'x402 Payments', icon: CircleDollarSign },
  { href: '/dashboard/messages',     label: 'Messages',     icon: MessageSquare },
  { href: '/dashboard/paper',         label: 'Paper Trading',icon: FlaskConical },
]

const LogoMark = () => (
  <div style={{
    width: 30, height: 30, background: 'var(--accent)', borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  }}>
    <svg viewBox="0 0 16 16" fill="none" width={16} height={16}>
      <rect x="2" y="2" width="5" height="5" rx="1.5" fill="#080809"/>
      <rect x="9" y="2" width="5" height="5" rx="1.5" fill="#080809"/>
      <rect x="2" y="9" width="5" height="5" rx="1.5" fill="#080809"/>
      <rect x="9" y="9" width="5" height="5" rx="1.5" fill="#080809" opacity="0.4"/>
    </svg>
  </div>
)

export function Sidebar({ pendingCount }: { pendingCount?: number }) {
  const pathname = usePathname()
  const { theme, toggleTheme, apiKey, setApiKey } = useApp()

  function signOut() {
    setApiKey('')
    localStorage.removeItem('agentbank_key')
    window.location.href = '/dashboard'
  }

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
      zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{ padding: '22px 18px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoMark />
          <div>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.2px' }}>
              AgentBank
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 1 }}>Operator Console</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '10px 10px', flex: 1 }}>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 10px', borderRadius: 8,
                background: active ? 'var(--accent2)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--muted)',
                fontSize: 13, fontWeight: active ? 500 : 400,
                transition: 'all 0.15s', cursor: 'pointer',
                borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
              }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)' } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--muted)' } }}
              >
                <Icon size={15} />
                <span style={{ flex: 1 }}>{label}</span>
                {label === 'Approvals' && pendingCount ? (
                  <span style={{
                    background: 'var(--amber)', color: '#080809',
                    borderRadius: 99, padding: '1px 6px', fontSize: 10, fontWeight: 600,
                  }}>{pendingCount}</span>
                ) : null}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
        <button onClick={toggleTheme} className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', marginBottom: 6 }}>
          {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
        {apiKey && (
          <>
            <div style={{
              marginBottom: 6, fontSize: 10, color: 'var(--muted2)',
              fontFamily: 'var(--mono)', background: 'var(--surface2)',
              borderRadius: 6, padding: '5px 8px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {apiKey.slice(0, 24)}...
            </div>
            <button onClick={signOut} className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', color: 'var(--red)', fontSize: 12 }}>
              <LogOut size={12} /> Sign out
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
