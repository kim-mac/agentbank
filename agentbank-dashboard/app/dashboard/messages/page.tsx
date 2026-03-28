'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useApp } from '@/lib/store'
import { Shell } from '@/components/ui/Shell'
import { getAgents, Agent } from '@/lib/api'
import { RefreshCw, MessageSquare, Bot } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1'

interface Message {
  id:              string
  senderAgentId:   string
  senderName:      string
  senderRole?:     string
  receiverAgentId?: string
  receiverName?:   string
  channelId?:      string
  channelType:     string
  content:         string
  messageType:     string
  actedOn:         boolean
  triggeredTxId?:  string
  createdAt:       string
  readAt?:         string
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)    return `${s}s ago`
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
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

function MessageBubble({ msg }: { msg: Message }) {
  const isActionRequest = msg.messageType === 'action_request'
  const isActionResult  = msg.messageType === 'action_result'

  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-start' }}>
      <AgentAvatar name={msg.senderName} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name + role + time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{msg.senderName}</span>
          {msg.senderRole && (
            <span className="badge badge-indigo" style={{ fontSize: 9 }}>{msg.senderRole}</span>
          )}
          {isActionRequest && <span className="badge badge-amber" style={{ fontSize: 9 }}>⚡ action request</span>}
          {isActionResult  && <span className="badge badge-green"  style={{ fontSize: 9 }}>✓ executed</span>}
          {msg.actedOn     && <span className="badge badge-accent" style={{ fontSize: 9 }}>tx triggered</span>}
          <span style={{ fontSize: 10, color: 'var(--muted2)', marginLeft: 'auto' }}>
            {timeAgo(msg.createdAt)}
          </span>
        </div>

        {/* Message content */}
        <div style={{
          background:   isActionRequest ? 'var(--amber-bg)'
                      : isActionResult  ? 'var(--green-bg)'
                      : 'var(--surface2)',
          border: `1px solid ${
            isActionRequest ? 'rgba(251,191,36,0.2)'
          : isActionResult  ? 'rgba(74,222,128,0.2)'
          : 'var(--border)'}`,
          borderLeft: `2px solid ${
            isActionRequest ? 'var(--amber)'
          : isActionResult  ? 'var(--green)'
          : 'var(--border2)'}`,
          borderRadius: '2px 10px 10px 10px',
          padding: '10px 14px',
          fontSize: 13, lineHeight: 1.6, color: 'var(--text)',
          wordBreak: 'break-word',
        }}>
          {msg.content}
        </div>

        {/* Tx link if acted on */}
        {msg.triggeredTxId && (
          <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 4, fontFamily: 'var(--mono)' }}>
            tx: {msg.triggeredTxId.slice(0, 24)}...
          </div>
        )}
      </div>
    </div>
  )
}

export default function MessagesPage() {
  const { apiKey } = useApp()
  const [agents, setAgents]     = useState<Agent[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<'group' | 'dm'>('group')
  const [newCount, setNewCount] = useState(0)

  const scrollRef   = useRef<HTMLDivElement>(null)
  const isAtBottom  = useRef(true)

  // Track scroll position — only auto-scroll if already at bottom
  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    const threshold = 60
    isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  }

  function scrollToBottom(force = false) {
    const el = scrollRef.current
    if (!el) return
    if (force || isAtBottom.current) {
      el.scrollTop = el.scrollHeight
    }
  }

  const loadMessages = useCallback(async (silent = false) => {
    if (!apiKey) return
    try {
      const [agRes, msgRes] = await Promise.all([
        fetch(`${API}/operators/agents`,   { headers: { 'x-api-key': apiKey } }).then(r => r.json()),
        fetch(`${API}/operators/messages`, { headers: { 'x-api-key': apiKey } }).then(r => r.json()),
      ])
      setAgents(agRes.agents || [])

      const incoming: Message[] = msgRes.messages || []

      if (!silent) {
        setMessages(incoming)
        setTimeout(() => scrollToBottom(true), 50)
      } else {
        setMessages(prev => {
          const newOnes = incoming.filter(m => !prev.find(p => p.id === m.id))
          if (newOnes.length > 0) {
            setNewCount(n => n + newOnes.length)
            setTimeout(() => scrollToBottom(), 50)
          }
          return incoming
        })
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [apiKey])

  useEffect(() => {
    loadMessages()
    const i = setInterval(() => loadMessages(true), 5000)
    return () => clearInterval(i)
  }, [loadMessages])

  const filtered = messages.filter(m => {
    if (filter === 'group') return m.channelType === 'group' || m.channelType === 'operator_group' || (m.channelId && !m.receiverAgentId)
    if (filter === 'dm')    return m.channelType === 'dm' || m.receiverAgentId
    return true
  })

  const groupAgents  = agents.filter(a => (a as any).inGroup)
  const activeAgents = groupAgents.filter(a => a.status === 'active')

  return (
    <Shell>
      <div style={{ padding: '32px 36px', maxWidth: 900 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 className="page-title">Messages</h1>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="live-dot" />
              Live · auto-refreshes every 5s
              {newCount > 0 && (
                <span
                  style={{ background: 'var(--accent2)', color: 'var(--accent)', borderRadius: 99, padding: '1px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}
                  onClick={() => { setNewCount(0); scrollToBottom(true) }}
                >
                  ↓ {newCount} new
                </span>
              )}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => loadMessages()}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {([
            ['group', 'Group Channel', groupAgents.length],
            ['dm',    'Direct',        null],
          ] as [string, string, number | null][]).map(([val, label, count]) => (
            <button key={val} onClick={() => setFilter(val as any)}
              className={`btn btn-sm ${filter === val ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
              {label}
              {count !== null && (
                <span style={{ background: filter === val ? 'rgba(0,0,0,0.2)' : 'var(--surface3)', borderRadius: 99, padding: '0px 5px', fontSize: 10 }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Full-width message feed */}
        <div className="card" style={{ marginBottom: 14 }}>
          {/* Channel header */}
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={13} color="var(--accent)" />
            <span style={{ fontSize: 12, fontWeight: 500 }}>
              {filter === 'group' ? 'Operator Group Channel' : filter === 'dm' ? 'Direct Messages' : 'All Messages'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted2)', marginLeft: 4 }}>
              {filtered.length} messages
            </span>
            {filter === 'group' && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className="live-dot" style={{ width: 5, height: 5 }} />
                <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
                  {activeAgents.length} agent{activeAgents.length !== 1 ? 's' : ''} active
                </span>
              </div>
            )}
          </div>

          {/* Messages scroll area */}
          <div
            ref={scrollRef}
            onScroll={onScroll}
            style={{ height: 520, overflowY: 'auto', padding: '16px 20px' }}
          >
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 70, marginBottom: 14, borderRadius: 10 }} />
              ))
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <MessageSquare size={28} color="var(--muted2)" style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>
                  {filter === 'group' ? 'No group messages yet' : 'No messages yet'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {filter === 'group'
                    ? 'Agents will appear here once they join the group and start talking'
                    : 'Messages will appear here'}
                </div>
              </div>
            ) : (
              filtered.map(msg => <MessageBubble key={msg.id} msg={msg} />)
            )}
          </div>
        </div>

        {/* Agent messaging status — below the feed */}
        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--muted2)', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Bot size={11} color="var(--accent)" /> Agent Status
          </div>
          {agents.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>No agents</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {agents.map(agent => {
                const messaging = (agent.policy as any)?.messagingRule
                const inGroup   = (agent as any).inGroup
                const roleName  = (agent as any).roleName
                return (
                  <div key={agent.id} style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    background: 'var(--surface2)', borderRadius: 9, padding: '9px 12px',
                    border: inGroup ? '1px solid var(--border2)' : '1px solid var(--border)',
                  }}>
                    <AgentAvatar name={agent.name} size={26} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {agent.name}
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                        {roleName && (
                          <span className="badge badge-indigo" style={{ fontSize: 9 }}>{roleName}</span>
                        )}
                        {inGroup && (
                          <span className="badge badge-accent" style={{ fontSize: 9 }}>group</span>
                        )}
                        {messaging?.canActOnMessages && (
                          <span className="badge badge-amber" style={{ fontSize: 9 }}>⚡ acts</span>
                        )}
                        <span className={`badge ${agent.status === 'active' ? 'badge-green' : 'badge-muted'}`} style={{ fontSize: 9 }}>
                          {agent.status}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}
