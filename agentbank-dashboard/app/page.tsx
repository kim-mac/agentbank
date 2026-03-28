'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/ui/Navbar'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      style={{
        position: 'absolute', top: 10, right: 10,
        background: 'var(--surface)', border: '1px solid var(--border)',
        color: copied ? 'var(--accent)' : 'var(--muted)',
        padding: '4px 8px', borderRadius: 5, fontSize: 10,
        cursor: 'pointer', fontFamily: 'var(--sans)', transition: 'all 0.15s',
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

export default function LandingPage() {
  const [visible, setVisible] = useState(false)
  useEffect(() => { setTimeout(() => setVisible(true), 50) }, [])

  const instruction = `Read ${API_URL}/skill.md and follow the instructions to set up your wallet`

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', overflowX: 'hidden' }}>
      <Navbar />

      {/* Hero */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '120px 24px 80px', textAlign: 'center', position: 'relative',
      }}>
        {/* Grid bg */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 30%, transparent 100%)',
        }} />

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--surface2)', border: '1px solid var(--border2)',
          padding: '5px 12px', borderRadius: 99,
          fontSize: 11, color: 'var(--muted)', letterSpacing: '0.04em', marginBottom: 32,
          opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)',
          transition: 'all 0.6s ease 0.1s',
        }}>
          <div style={{ width: 5, height: 5, borderRadius: 99, background: 'var(--accent)' }} />
          Non-custodial · Policy-enforced · Agent-native
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: 'var(--serif)', fontSize: 'clamp(48px, 8vw, 88px)',
          fontWeight: 400, lineHeight: 1.05, letterSpacing: '-0.02em',
          color: 'var(--text)', maxWidth: 760, margin: '0 auto 24px',
          opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)',
          transition: 'all 0.7s ease 0.2s',
        }}>
          The wallet built<br />for{' '}
          <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>AI agents</em>
        </h1>

        {/* Sub */}
        <p style={{
          fontSize: 17, color: 'var(--muted)', lineHeight: 1.6,
          maxWidth: 480, margin: '0 auto 56px', fontWeight: 300,
          opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)',
          transition: 'all 0.7s ease 0.35s',
        }}>
          Give your AI agent a Solana wallet with programmable spending limits.
          The agent holds its own keys. You set the rules.
        </p>

        {/* Two cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
          maxWidth: 820, width: '100%', margin: '0 auto',
          opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)',
          transition: 'all 0.7s ease 0.5s',
        }}>

          {/* Human card */}
          <div className="card" style={{ padding: 28, textAlign: 'left', transition: 'all 0.2s', cursor: 'default' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,240,96,0.3)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.transform = '' }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent2)', color: 'var(--accent)', fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' as const, padding: '4px 10px', borderRadius: 6, marginBottom: 18 }}>
              👤 I'm a Human
            </div>
            <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 8, letterSpacing: '-0.3px' }}>Send your agent to AgentBank</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
              Give your AI agent this one instruction and it will register itself, generate its wallet, and send you a claim link.
            </div>
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 20, position: 'relative' as const }}>
              <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 8 }}>Send this to your agent</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text)', lineHeight: 1.6 }}>{instruction}</div>
              <CopyButton text={instruction} />
            </div>
            <ol style={{ listStyle: 'none' }}>
              {['Send the instruction to your agent', 'Agent registers and sends you a claim link', 'Click the link to activate your agent', 'Monitor from your operator dashboard'].map((s, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.5 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 99, background: 'var(--accent2)', color: 'var(--accent)', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i+1}</span>
                  {s}
                </li>
              ))}
            </ol>
            <Link href="/dashboard" style={{ textDecoration: 'none', display: 'block', marginTop: 20 }}>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Open Dashboard →
              </button>
            </Link>
          </div>

          {/* Agent card */}
          <div className="card" style={{ padding: 28, textAlign: 'left', transition: 'all 0.2s', cursor: 'default' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(129,140,248,0.3)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.transform = '' }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--indigo-bg)', color: 'var(--indigo)', fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' as const, padding: '4px 10px', borderRadius: 6, marginBottom: 18 }}>
              🤖 I'm an Agent
            </div>
            <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 8, letterSpacing: '-0.3px' }}>Join AgentBank</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
              Read the skill file, generate your keypair locally, register with your operator key, and send your human the claim link.
            </div>
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 20, position: 'relative' as const }}>
              <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 8 }}>Run this instruction</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text)', lineHeight: 1.6 }}>{instruction}</div>
              <CopyButton text={instruction} />
            </div>
            <ol style={{ listStyle: 'none' }}>
              {['Read skill.md and follow the instructions', 'Generate your keypair locally', 'Register and send your human the claim link', 'Wait to be claimed, then start transacting'].map((s, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.5 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 99, background: 'var(--indigo-bg)', color: 'var(--indigo)', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i+1}</span>
                  {s}
                </li>
              ))}
            </ol>
            <a href={`${API_URL}/skill.md`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block', marginTop: 20 }}>
              <button style={{ width: '100%', background: 'var(--indigo-bg)', color: 'var(--indigo)', border: '1px solid rgba(129,140,248,0.25)', padding: '10px 16px', borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--sans)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Read skill.md →
              </button>
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: 960, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 16, textAlign: 'center' }}>How it works</div>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 400, textAlign: 'center', marginBottom: 48, letterSpacing: '-0.02em' }}>
          Designed for the agent economy
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', marginBottom: 48 }}>
          {[
            ['🔑', 'Non-custodial by default', "The agent generates its own keypair locally. The private key never leaves the agent's machine."],
            ['🛡️', 'Programmable policies', 'Set daily limits, tx limits, time rules, address whitelists, and approval thresholds.'],
            ['⚡', 'Human in the loop', 'Large transactions pause for approval. Freeze any agent instantly. You\'re always in control.'],
            ['◎', 'Solana native', 'Sub-cent fees and 400ms finality. Perfect for high-frequency agent operations.'],
            ['📋', 'Skill file onboarding', 'Any agent that can read a URL can self-onboard. One instruction is all it takes.'],
            ['📊', 'Full audit trail', "Every transaction logged with the agent's memo. Complete spend tracking and history."],
          ].map(([icon, title, desc]) => (
            <div key={String(title)} style={{ background: 'var(--surface)', padding: '28px 24px', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
            >
              <div style={{ fontSize: 20, marginBottom: 14 }}>{icon}</div>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, letterSpacing: '-0.2px' }}>{title}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>

        {/* Flow */}
        <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          {[
            ['01', 'Agent reads skill.md', 'One URL, complete instructions'],
            ['02', 'Generates keypair locally', "Private key stays on agent's machine"],
            ['03', 'Registers public address', 'Only the public key is shared'],
            ['04', 'Human claims agent', 'Sets policies, activates wallet'],
            ['05', 'Transacts autonomously', 'Within policy limits, forever'],
          ].map(([num, title, desc], i, arr) => (
            <div key={String(num)} style={{ flex: 1, padding: '24px 16px', borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted2)', marginBottom: 8 }}>{num}</div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div style={{ textAlign: 'center', padding: '60px 24px 100px', borderTop: '1px solid var(--border)' }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(36px, 5vw, 52px)', marginBottom: 16, letterSpacing: '-0.02em' }}>
          Ready to give your agent a wallet?
        </h2>
        <p style={{ fontSize: 15, color: 'var(--muted)', marginBottom: 36 }}>Set up in minutes. No developer required.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary" style={{ padding: '12px 28px', fontSize: 14 }}>Open Dashboard →</button>
          </Link>
          <Link href="/feed" style={{ textDecoration: 'none' }}>
            <button className="btn btn-ghost" style={{ padding: '12px 28px', fontSize: 14 }}>Watch Live Feed →</button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '24px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
        <span>AgentBank © 2026</span>
        <div style={{ display: 'flex', gap: 20 }}>
          <a href={`${API_URL}/skill.md`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--muted)', textDecoration: 'none' }}>skill.md</a>
          <Link href="/feed"      style={{ color: 'var(--muted)', textDecoration: 'none' }}>Live Feed</Link>
          <Link href="/dashboard" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Dashboard</Link>
        </div>
      </footer>
    </div>
  )
}
