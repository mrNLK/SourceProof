import { useState, useCallback, useEffect } from 'react'
import type { SearchHistoryEntry, SearchQuery, SearchHistoryMetadata } from '@/types'

const STORAGE_KEY = 'sourcekit_search_history'
const MAX_HISTORY = 10

function loadHistory(): SearchHistoryEntry[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryEntry[]>(loadHistory)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  }, [history])

  const addEntry = useCallback((query: SearchQuery, resultCount: number, metadata?: SearchHistoryMetadata) => {
    const entry: SearchHistoryEntry = {
      id: crypto.randomUUID(),
      query_params: query,
      result_count: resultCount,
      metadata,
      created_at: new Date().toISOString(),
    }
    setHistory(prev => [entry, ...prev].slice(0, MAX_HISTORY))
  }, [])

  const removeEntry = useCallback((id: string) => {
    setHistory(prev => prev.filter(e => e.id !== id))
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
  }, [])

  return { history, addEntry, removeEntry, clearHistory }
}
