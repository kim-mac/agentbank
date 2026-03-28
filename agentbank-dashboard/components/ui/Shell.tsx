'use client'
import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/lib/store'
import { Sidebar } from './Sidebar'
import { ConnectScreen } from './ConnectScreen'
import { getApprovals } from '@/lib/api'

export function Shell({ children }: { children: React.ReactNode }) {
  const { apiKey } = useApp()
  const [pendingCount, setPendingCount] = useState(0)

  const fetchApprovals = useCallback(async () => {
    if (!apiKey) return
    try {
      const res = await getApprovals(apiKey)
      setPendingCount(res.pendingApprovals?.length || 0)
    } catch { /* silent */ }
  }, [apiKey])

  useEffect(() => {
    fetchApprovals()
    const interval = setInterval(fetchApprovals, 10000)
    return () => clearInterval(interval)
  }, [fetchApprovals])

  if (!apiKey) return <ConnectScreen />

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar pendingCount={pendingCount} />
      <main style={{ flex: 1, overflowY: 'auto', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 1120 }}>
          {children}
        </div>
      </main>
    </div>
  )
}
