import { useState, useCallback, useEffect } from 'react'
import type { Candidate, CandidateStage } from '@/types'
import { calculateScore } from '@/lib/scoring'

const STORAGE_KEY = 'sourcekit_candidates'

function loadCandidates(): Candidate[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveCandidates(candidates: Candidate[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(candidates))
    return true
  } catch (err) {
    console.error('Failed to save candidates to localStorage:', err)
    return false
  }
}

export function useCandidates() {
  const [candidates, setCandidates] = useState<Candidate[]>(loadCandidates)
  const [stageFilter, setStageFilter] = useState<CandidateStage | 'all'>('all')
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [sortByScore, setSortByScore] = useState(false)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    const ok = saveCandidates(candidates)
    setSaveError(!ok)
  }, [candidates])

  const addCandidate = useCallback((candidate: Omit<Candidate, 'id' | 'created_at' | 'stage' | 'score' | 'notes' | 'tags'>) => {
    const isDuplicate = candidates.some(
      c => c.name.toLowerCase() === candidate.name.toLowerCase() &&
           c.company.toLowerCase() === candidate.company.toLowerCase()
    )
    if (isDuplicate) {
      return { success: false, error: 'Duplicate candidate: same name and company already exists' }
    }

    const newCandidate: Candidate = {
      ...candidate,
      id: crypto.randomUUID(),
      stage: 'sourced',
      score: 0,
      notes: '',
      tags: [],
      created_at: new Date().toISOString(),
    }
    newCandidate.score = calculateScore(newCandidate)
    setCandidates(prev => [newCandidate, ...prev])
    return { success: true, candidate: newCandidate }
  }, [candidates])

  const updateCandidate = useCallback((id: string, updates: Partial<Candidate>) => {
    setCandidates(prev => prev.map(c => {
      if (c.id !== id) return c
      const updated = { ...c, ...updates, updated_at: new Date().toISOString() }
      if (updates.signals || updates.github_profile || updates.enrichment_data) {
        updated.score = calculateScore(updated)
      }
      return updated
    }))
  }, [])

  const deleteCandidate = useCallback((id: string) => {
    setCandidates(prev => prev.filter(c => c.id !== id))
  }, [])

  const updateStage = useCallback((id: string, stage: CandidateStage) => {
    updateCandidate(id, { stage })
  }, [updateCandidate])

  const updateNotes = useCallback((id: string, notes: string) => {
    updateCandidate(id, { notes })
  }, [updateCandidate])

  const addTag = useCallback((id: string, tag: string) => {
    const normalized = tag.toLowerCase().replace(/^#/, '')
    setCandidates(prev => prev.map(c => {
      if (c.id !== id || c.tags.includes(normalized)) return c
      return { ...c, tags: [...c.tags, normalized] }
    }))
  }, [])

  const removeTag = useCallback((id: string, tag: string) => {
    setCandidates(prev => prev.map(c => {
      if (c.id !== id) return c
      return { ...c, tags: c.tags.filter(t => t !== tag) }
    }))
  }, [])

  const filteredCandidates = candidates
    .filter(c => stageFilter === 'all' || c.stage === stageFilter)
    .filter(c => tagFilter.length === 0 || tagFilter.some(t => c.tags.includes(t)))
    .sort((a, b) => {
      if (sortByScore) return b.score - a.score
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const stageCounts = candidates.reduce((acc, c) => {
    acc[c.stage] = (acc[c.stage] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const allTags = [...new Set(candidates.flatMap(c => c.tags))].sort()

  return {
    candidates: filteredCandidates,
    allCandidates: candidates,
    stageCounts,
    allTags,
    stageFilter,
    setStageFilter,
    tagFilter,
    setTagFilter,
    sortByScore,
    setSortByScore,
    saveError,
    addCandidate,
    updateCandidate,
    deleteCandidate,
    updateStage,
    updateNotes,
    addTag,
    removeTag,
  }
}
