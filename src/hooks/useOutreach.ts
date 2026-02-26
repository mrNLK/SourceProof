import { useState, useCallback, useEffect } from 'react'
import type { OutreachEntry } from '@/types'

const STORAGE_KEY = 'sourcekit_outreach'

function loadOutreach(): OutreachEntry[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function useOutreach() {
  const [entries, setEntries] = useState<OutreachEntry[]>(loadOutreach)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }, [entries])

  const saveOutreach = useCallback(
    (candidateKey: string, candidateName: string, message: string, channel: OutreachEntry['channel'] = 'email') => {
      const entry: OutreachEntry = {
        id: crypto.randomUUID(),
        candidate_key: candidateKey,
        candidate_name: candidateName,
        message,
        channel,
        created_at: new Date().toISOString(),
      }
      setEntries(prev => [entry, ...prev])
      return entry
    },
    []
  )

  const getHistory = useCallback(
    (candidateKey: string): OutreachEntry[] => {
      return entries.filter(e => e.candidate_key === candidateKey)
    },
    [entries]
  )

  const clearHistory = useCallback(() => {
    setEntries([])
  }, [])

  return { entries, saveOutreach, getHistory, clearHistory }
}
