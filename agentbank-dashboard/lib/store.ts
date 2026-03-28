'use client'
// lib/store.ts — Simple context for API key + theme state

import { createContext, useContext } from 'react'

export interface AppState {
  apiKey: string
  setApiKey: (key: string) => void
  theme: 'dark' | 'light'
  toggleTheme: () => void
}

export const AppContext = createContext<AppState>({
  apiKey: '',
  setApiKey: () => {},
  theme: 'dark',
  toggleTheme: () => {},
})

export const useApp = () => useContext(AppContext)
