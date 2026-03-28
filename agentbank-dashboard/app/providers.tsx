'use client'
import { useState, useEffect } from 'react'
import { AppContext } from '@/lib/store'

export function Providers({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedKey   = localStorage.getItem('agentbank_key') || ''
    const savedTheme = (localStorage.getItem('agentbank_theme') || 'dark') as 'dark' | 'light'
    setApiKeyState(savedKey)
    setTheme(savedTheme)
    // Apply correct class — we use html.light for light mode, no class = dark
    document.documentElement.classList.toggle('light', savedTheme === 'light')
  }, [])

  const setApiKey = (key: string) => {
    setApiKeyState(key)
    localStorage.setItem('agentbank_key', key)
  }

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('agentbank_theme', next)
    document.documentElement.classList.toggle('light', next === 'light')
  }

  if (!mounted) return null

  return (
    <AppContext.Provider value={{ apiKey, setApiKey, theme, toggleTheme }}>
      {children}
    </AppContext.Provider>
  )
}
