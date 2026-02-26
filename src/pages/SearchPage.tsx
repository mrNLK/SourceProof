import { useState, useCallback } from 'react'
import { Search as SearchIcon, EyeOff, Eye, AlertCircle } from 'lucide-react'
import { SearchForm } from '@/components/search/SearchForm'
import { CandidateCard } from '@/components/search/CandidateCard'
import { FilterBar } from '@/components/search/FilterBar'
import { SearchHistory } from '@/components/search/SearchHistory'
import { EmptyState } from '@/components/ui/EmptyState'
import { useCandidates } from '@/hooks/useCandidates'
import { useSearchHistory } from '@/hooks/useSearchHistory'
import { useSettings } from '@/hooks/useSettings'
import { searchGitHubUsers, fetchGitHubProfile } from '@/services/github'
import { parseSignals } from '@/lib/scoring'
import { captureException } from '@/lib/sentry'
import { track } from '@/lib/analytics'
import type { Candidate, SearchQuery, SourceType } from '@/types'

function loadHidePipelined(): boolean {
  try {
    return localStorage.getItem('sourcekit-hide-pipelined') === 'true'
  } catch {
    return false
  }
}

export function SearchPage() {
  const [results, setResults] = useState<Candidate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<SourceType | 'all'>('all')
  const [hasSearched, setHasSearched] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hidePipelined, setHidePipelined] = useState(loadHidePipelined)

  const { addCandidate, allCandidates } = useCandidates()
  const { history, addEntry, removeEntry, clearHistory } = useSearchHistory()
  const { settings } = useSettings()

  const handleSearch = useCallback(async (query: SearchQuery) => {
    setIsLoading(true)
    setHasSearched(true)
    setSearchError(null)
    const newResults: Candidate[] = []
    const errors: string[] = []

    try {
      // GitHub search
      if (query.github_handle) {
        try {
          const profile = await fetchGitHubProfile(query.github_handle, settings.github_token || undefined)
          const bioText = `${profile.bio || ''} ${profile.repositories.map(r => r.description).join(' ')}`
          const signals = parseSignals(bioText)

          newResults.push({
            id: crypto.randomUUID(),
            name: query.name || profile.username,
            company: query.company || '',
            role: query.role || '',
            bio: profile.bio || undefined,
            avatar_url: profile.avatar_url,
            github_handle: profile.username,
            source: 'github',
            enrichment_data: null,
            github_profile: profile,
            stage: 'sourced',
            score: 0,
            notes: '',
            tags: [],
            signals,
            created_at: new Date().toISOString(),
          })
        } catch (err) {
          console.error('GitHub fetch error:', err)
          captureException(err, { github_handle: query.github_handle })
          errors.push(`GitHub profile lookup failed for "${query.github_handle}"`)
        }
      }

      // Capability-based GitHub search
      if (query.capability_query) {
        try {
          const ghQuery = query.capability_query + (query.role ? ` ${query.role}` : '')
          const users = await searchGitHubUsers(ghQuery, settings.github_token || undefined)

          for (const user of users) {
            if (newResults.some(r => r.github_handle === user.username)) continue
            const signals = parseSignals(user.bio)
            newResults.push({
              id: crypto.randomUUID(),
              name: user.username,
              company: '',
              role: query.role || '',
              bio: user.bio || undefined,
              avatar_url: user.avatar_url,
              github_handle: user.username,
              source: 'github',
              enrichment_data: null,
              github_profile: null,
              stage: 'sourced',
              score: 0,
              notes: '',
              tags: [],
              signals,
              created_at: new Date().toISOString(),
            })
          }
        } catch (err) {
          console.error('GitHub search error:', err)
          captureException(err, { capability_query: query.capability_query })
          errors.push('GitHub search failed — check your token in Settings or try again')
        }
      }

      // Name/company search — generate web-sourced placeholder results
      if (query.name && query.company) {
        const exists = newResults.some(
          r => r.name.toLowerCase() === query.name!.toLowerCase()
        )
        if (!exists) {
          const signals = parseSignals(`${query.name} ${query.company} ${query.role || ''}`)
          newResults.push({
            id: crypto.randomUUID(),
            name: query.name,
            company: query.company,
            role: query.role || '',
            source: 'web',
            enrichment_data: null,
            stage: 'sourced',
            score: 0,
            notes: '',
            tags: [],
            signals,
            created_at: new Date().toISOString(),
          })
        }
      }

      setResults(newResults)
      addEntry(query, newResults.length)
      track('search_executed', { result_count: newResults.length, has_github: Boolean(query.github_handle), has_capability: Boolean(query.capability_query) })

      if (errors.length > 0) {
        setSearchError(errors.join('. '))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Search failed'
      setSearchError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [settings.github_token, addEntry])

  const handleSave = useCallback((candidate: Candidate) => {
    addCandidate(candidate)
    track('candidate_pipelined', { source: candidate.source })
  }, [addCandidate])

  const isSaved = useCallback((candidate: Candidate) => {
    return allCandidates.some(
      c => c.name.toLowerCase() === candidate.name.toLowerCase() &&
           c.company.toLowerCase() === candidate.company.toLowerCase()
    )
  }, [allCandidates])

  const toggleHidePipelined = useCallback(() => {
    setHidePipelined(prev => {
      const next = !prev
      localStorage.setItem('sourcekit-hide-pipelined', String(next))
      return next
    })
  }, [])

  const sourceFiltered = sourceFilter === 'all'
    ? results
    : results.filter(r => r.source === sourceFilter)

  const pipelinedCount = hidePipelined
    ? sourceFiltered.filter(r => isSaved(r)).length
    : 0

  const filteredResults = hidePipelined
    ? sourceFiltered.filter(r => !isSaved(r))
    : sourceFiltered

  const sourceCounts = results.reduce((acc, r) => {
    acc[r.source] = (acc[r.source] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="flex flex-col">
      <SearchForm onSearch={handleSearch} isLoading={isLoading} />

      {results.length > 0 && (
        <div className="flex items-center gap-2 pr-4">
          <div className="flex-1 overflow-x-auto">
            <FilterBar
              activeFilter={sourceFilter}
              onFilterChange={setSourceFilter}
              counts={sourceCounts}
            />
          </div>
          <button
            onClick={toggleHidePipelined}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
              hidePipelined
                ? 'bg-primary/20 text-primary'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {hidePipelined ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            Hide pipelined
            {hidePipelined && pipelinedCount > 0 && (
              <span className="text-[10px] text-primary/70">({pipelinedCount} hidden)</span>
            )}
          </button>
        </div>
      )}

      {/* Search error */}
      {searchError && (
        <div className="mx-4 mb-2 flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive flex-1">{searchError}</p>
          <button onClick={() => setSearchError(null)} className="text-destructive/60 hover:text-destructive text-xs">
            dismiss
          </button>
        </div>
      )}

      {hasSearched && results.length === 0 && !isLoading && (
        <EmptyState
          icon={SearchIcon}
          title="No results found"
          description="Try broadening your search or using different keywords"
        />
      )}

      {filteredResults.length > 0 && (
        <div className="space-y-3 px-4 py-2">
          {filteredResults.map(candidate => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              onSave={handleSave}
              saved={isSaved(candidate)}
              showScore={false}
            />
          ))}
        </div>
      )}

      {!hasSearched && (
        <SearchHistory
          history={history}
          onRerun={handleSearch}
          onDelete={removeEntry}
          onClear={clearHistory}
        />
      )}
    </div>
  )
}
