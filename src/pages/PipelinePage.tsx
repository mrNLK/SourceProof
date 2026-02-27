import { useState, useCallback, useRef, useMemo } from 'react'
import { GitBranch, Download, Share2, AlertCircle, CheckCircle2, Info, Columns3, List } from 'lucide-react'
import { TagFilter } from '@/components/pipeline/TagFilter'
import { PipelineCard } from '@/components/pipeline/PipelineCard'
import { OutreachModal } from '@/components/pipeline/OutreachModal'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useCandidates } from '@/hooks/useCandidates'
import { useSettings } from '@/hooks/useSettings'
import { useOutreach } from '@/hooks/useOutreach'
import { useWatchlist } from '@/hooks/useWatchlist'
import { exportToCSV, exportToJSON, shareToSlack } from '@/services/export'
import { generateOutreach } from '@/services/outreach'
import { captureException } from '@/lib/sentry'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import type { Candidate, CandidateStage } from '@/types'

const STAGES: Array<{ value: CandidateStage; label: string; color: string; bgColor: string; borderColor: string }> = [
  { value: 'sourced', label: 'Sourced', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
  { value: 'contacted', label: 'Contacted', color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30' },
  { value: 'responded', label: 'Responded', color: 'text-sky-400', bgColor: 'bg-sky-500/10', borderColor: 'border-sky-500/30' },
  { value: 'screen', label: 'Screen', color: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30' },
  { value: 'offer', label: 'Offer', color: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30' },
]

export function PipelinePage() {
  const {
    allCandidates,
    allTags,
    tagFilter,
    setTagFilter,
    saveError,
    updateStage,
    updateNotes,
    addTag,
    removeTag,
    deleteCandidate,
  } = useCandidates()

  const { settings } = useSettings()
  const { saveOutreach, getHistory } = useOutreach()
  const { isWatchlisted, toggleWatchlist } = useWatchlist()

  const [outreachCandidate, setOutreachCandidate] = useState<Candidate | null>(null)
  const [outreachMessage, setOutreachMessage] = useState<string | null>(null)
  const [outreachLoading, setOutreachLoading] = useState(false)
  const [outreachSource, setOutreachSource] = useState<'ai' | 'template' | null>(null)
  const [notice, setNotice] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [dragOverStage, setDragOverStage] = useState<CandidateStage | null>(null)
  const draggedIdRef = useRef<string | null>(null)

  const showNotice = useCallback((type: 'error' | 'success' | 'info', message: string) => {
    setNotice({ type, message })
    setTimeout(() => setNotice(null), 4000)
  }, [])

  // Filter candidates by tag
  const candidates = useMemo(() => {
    return allCandidates.filter(c => tagFilter.length === 0 || tagFilter.some(t => c.tags.includes(t)))
  }, [allCandidates, tagFilter])

  // Group candidates by stage for Kanban view
  const candidatesByStage = useMemo(() => {
    const grouped: Record<CandidateStage, Candidate[]> = {
      sourced: [],
      contacted: [],
      responded: [],
      screen: [],
      offer: [],
    }
    for (const c of candidates) {
      grouped[c.stage]?.push(c)
    }
    return grouped
  }, [candidates])

  const handleGenerateOutreach = useCallback(async (candidate: Candidate) => {
    setOutreachCandidate(candidate)
    setOutreachLoading(true)
    setOutreachMessage(null)
    setOutreachSource(null)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const result = await generateOutreach(candidate, settings, supabaseUrl, supabaseKey)
      setOutreachMessage(result.message)
      setOutreachSource(result.source)
      const key = candidate.github_handle || candidate.name.toLowerCase().replace(/\s+/g, '-')
      saveOutreach(key, candidate.name, result.message)
      track('outreach_generated', { candidate_source: candidate.source, outreach_source: result.source })

      if (result.source === 'template') {
        showNotice('info', 'AI generation failed — using template fallback. Configure Supabase for AI outreach.')
      }
    } catch (err) {
      console.error('Outreach error:', err)
      captureException(err)
      setOutreachMessage(null)
      showNotice('error', 'Failed to generate outreach message. Try again.')
    } finally {
      setOutreachLoading(false)
    }
  }, [settings, saveOutreach, showNotice])

  const handleToggleTag = useCallback((tag: string) => {
    setTagFilter(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }, [setTagFilter])

  const handleExport = (format: 'csv' | 'json' = 'csv') => {
    try {
      if (format === 'json') {
        exportToJSON(candidates)
      } else {
        exportToCSV(candidates)
      }
      showNotice('success', `Pipeline exported to ${format.toUpperCase()}`)
      track('export_triggered', { format, count: candidates.length })
    } catch (err) {
      console.error('Export error:', err)
      captureException(err)
      showNotice('error', `Failed to export ${format.toUpperCase()}`)
    }
  }

  const handleShareSlack = async () => {
    if (!settings.slack_webhook_url) {
      showNotice('error', 'Set Slack webhook URL in Settings first')
      return
    }
    try {
      await shareToSlack(candidates, settings.slack_webhook_url)
      showNotice('success', 'Shared to Slack!')
    } catch (err) {
      console.error('Slack error:', err)
      captureException(err)
      showNotice('error', 'Failed to share to Slack')
    }
  }

  // Drag and drop handlers
  const handleDragStart = useCallback((candidateId: string) => {
    draggedIdRef.current = candidateId
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, stage: CandidateStage) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStage(stage)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverStage(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetStage: CandidateStage) => {
    e.preventDefault()
    setDragOverStage(null)
    const candidateId = draggedIdRef.current
    if (!candidateId) return
    draggedIdRef.current = null

    const candidate = allCandidates.find(c => c.id === candidateId)
    if (candidate && candidate.stage !== targetStage) {
      updateStage(candidateId, targetStage)
      track('pipeline_stage_changed', { from: candidate.stage, to: targetStage, method: 'drag' })
    }
  }, [allCandidates, updateStage])

  const handleDragEnd = useCallback(() => {
    draggedIdRef.current = null
    setDragOverStage(null)
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Tag Filter */}
      <TagFilter
        allTags={allTags}
        activeTags={tagFilter}
        onToggleTag={handleToggleTag}
      />

      {/* Storage warning */}
      {saveError && (
        <div className="mx-3 sm:mx-4 mt-2 flex items-center gap-2 p-2.5 rounded-lg text-sm bg-destructive/10 border border-destructive/20 text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">Storage full — changes may not be saved. Export your pipeline and clear old data in Settings.</span>
        </div>
      )}

      {/* Notice banner */}
      {notice && (
        <div className={`mx-3 sm:mx-4 mt-2 flex items-center gap-2 p-2.5 rounded-lg text-sm ${
          notice.type === 'error'
            ? 'bg-destructive/10 border border-destructive/20 text-destructive'
            : notice.type === 'info'
            ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
            : 'bg-green-500/10 border border-green-500/20 text-green-400'
        }`}>
          {notice.type === 'error'
            ? <AlertCircle className="w-4 h-4 shrink-0" />
            : notice.type === 'info'
            ? <Info className="w-4 h-4 shrink-0" />
            : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span className="flex-1">{notice.message}</span>
          <button onClick={() => setNotice(null)} className="opacity-60 hover:opacity-100 text-xs">dismiss</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2">
        <span className="text-xs sm:text-sm text-muted-foreground">
          {allCandidates.length} candidate{allCandidates.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="flex items-center bg-secondary rounded-lg p-0.5">
            <Button
              size="sm"
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              onClick={() => setViewMode('kanban')}
              className="gap-1 px-2 h-7"
            >
              <Columns3 className="w-3 h-3" />
              <span className="hidden sm:inline text-xs">Board</span>
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              onClick={() => setViewMode('list')}
              className="gap-1 px-2 h-7"
            >
              <List className="w-3 h-3" />
              <span className="hidden sm:inline text-xs">List</span>
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => handleExport('csv')} className="gap-1 px-2 sm:px-3">
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleExport('json')} className="gap-1 px-2 sm:px-3">
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">JSON</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={handleShareSlack} className="gap-1 px-2 sm:px-3">
            <Share2 className="w-3 h-3" />
            <span className="hidden sm:inline">Slack</span>
          </Button>
        </div>
      </div>

      {allCandidates.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="Pipeline is empty"
          description="Save candidates from Search to start building your pipeline"
        />
      ) : viewMode === 'kanban' ? (
        /* Kanban Board View */
        <div className="flex-1 overflow-x-auto px-3 sm:px-4 pb-4">
          <div className="flex gap-3 min-w-max">
            {STAGES.map(stage => {
              const stageCandidates = candidatesByStage[stage.value]
              const isDragOver = dragOverStage === stage.value
              return (
                <div
                  key={stage.value}
                  className={cn(
                    'w-72 flex flex-col rounded-xl border transition-colors',
                    isDragOver
                      ? `${stage.borderColor} ${stage.bgColor}`
                      : 'border-border bg-secondary/30'
                  )}
                  onDragOver={(e) => handleDragOver(e, stage.value)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stage.value)}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2.5 h-2.5 rounded-full', stage.bgColor.replace('/10', ''))} />
                      <span className={cn('text-sm font-semibold', stage.color)}>{stage.label}</span>
                    </div>
                    <span className={cn(
                      'text-xs font-mono px-1.5 py-0.5 rounded-full',
                      stageCandidates.length > 0
                        ? `${stage.bgColor} ${stage.color}`
                        : 'bg-secondary text-muted-foreground'
                    )}>
                      {stageCandidates.length}
                    </span>
                  </div>

                  {/* Column Body */}
                  <div className="flex-1 p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-220px)] overflow-y-auto">
                    {stageCandidates.length === 0 ? (
                      <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/50">
                        Drop here
                      </div>
                    ) : (
                      stageCandidates.map(candidate => (
                        <div
                          key={candidate.id}
                          draggable
                          onDragStart={() => handleDragStart(candidate.id)}
                          onDragEnd={handleDragEnd}
                        >
                          <PipelineCard
                            candidate={candidate}
                            onUpdateStage={updateStage}
                            onUpdateNotes={updateNotes}
                            onAddTag={addTag}
                            onRemoveTag={removeTag}
                            onDelete={deleteCandidate}
                            onGenerateOutreach={handleGenerateOutreach}
                            onToggleWatchlist={toggleWatchlist}
                            isWatchlisted={isWatchlisted(candidate.id)}
                            compact
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* List View (original layout) */
        <div className="space-y-3 px-3 sm:px-4 pb-4">
          {candidates.map(candidate => (
            <PipelineCard
              key={candidate.id}
              candidate={candidate}
              onUpdateStage={updateStage}
              onUpdateNotes={updateNotes}
              onAddTag={addTag}
              onRemoveTag={removeTag}
              onDelete={deleteCandidate}
              onGenerateOutreach={handleGenerateOutreach}
              onToggleWatchlist={toggleWatchlist}
              isWatchlisted={isWatchlisted(candidate.id)}
            />
          ))}
        </div>
      )}

      {outreachCandidate && (
        <OutreachModal
          candidate={outreachCandidate}
          message={outreachMessage}
          isLoading={outreachLoading}
          history={getHistory(outreachCandidate.github_handle || outreachCandidate.name.toLowerCase().replace(/\s+/g, '-'))}
          onClose={() => setOutreachCandidate(null)}
          onRegenerate={() => handleGenerateOutreach(outreachCandidate)}
          source={outreachSource}
        />
      )}
    </div>
  )
}
