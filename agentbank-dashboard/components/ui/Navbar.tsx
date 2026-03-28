'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const LogoMark = () => (
  <div style={{
    width: 28, height: 28, background: 'var(--accent)', borderRadius: 7,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  }}>
    <svg viewBox="0 0 16 16" fill="none" width={14} height={14}>
      <rect x="2" y="2" width="5" height="5" rx="1.5" fill="#080809"/>
      <rect x="9" y="2" width="5" height="5" rx="1.5" fill="#080809"/>
      <rect x="2" y="9" width="5" height="5" rx="1.5" fill="#080809"/>
      <rect x="9" y="9" width="5" height="5" rx="1.5" fill="#080809" opacity="0.4"/>
    </svg>
  </div>
)

export function Navbar() {
  const pathname  = usePathname()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navLinks = [
    { href: '/',            label: 'Home' },
    { href: '/feed',        label: 'Live Feed' },
    { href: '/leaderboard', label: 'Leaderboard' },
  ]

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 48px',
      background: scrolled ? 'rgba(8,8,9,0.92)' : 'transparent',
      borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      transition: 'all 0.3s',
    }}>
      {/* Logo */}
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9 }}>
        <LogoMark />
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.2px' }}>
          AgentBank
        </span>
      </Link>

      {/* Nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {navLinks.map(({ href, label }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <div style={{
                padding: '6px 14px', borderRadius: 8,
                fontSize: 13, color: active ? 'var(--text)' : 'var(--muted)',
                background: active ? 'var(--surface2)' : 'transparent',
                transition: 'all 0.15s', cursor: 'pointer',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--muted)' }}
              >
                {label}
              </div>
            </Link>
          )
        })}
      </div>

      {/* CTA */}
      <Link href="/dashboard" style={{ textDecoration: 'none' }}>
        <button style={{
          background: 'var(--surface2)', border: '1px solid var(--border2)',
          color: 'var(--text)', padding: '7px 16px', borderRadius: 8,
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
          fontFamily: 'var(--sans)', transition: 'all 0.15s',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--accent)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text)'
        }}
        >
          Operator Dashboard
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </Link>
    </nav>
  )
}
