import { cn } from '@/lib/utils'
import type { CandidateStage } from '@/types'

interface StageFilterProps {
  activeStage: CandidateStage | 'all'
  onStageChange: (stage: CandidateStage | 'all') => void
  counts: Record<string, number>
}

const stages: Array<{ value: CandidateStage | 'all'; label: string; shortLabel: string; color: string }> = [
  { value: 'all', label: 'All', shortLabel: 'All', color: 'bg-primary' },
  { value: 'sourced', label: 'Sourced', shortLabel: 'Src', color: 'bg-blue-500' },
  { value: 'contacted', label: 'Contacted', shortLabel: 'Ctd', color: 'bg-violet-500' },
  { value: 'responded', label: 'Responded', shortLabel: 'Rsp', color: 'bg-amber-500' },
  { value: 'screen', label: 'Screen', shortLabel: 'Scr', color: 'bg-orange-500' },
  { value: 'offer', label: 'Offer', shortLabel: 'Ofr', color: 'bg-green-500' },
]

export function StageFilter({ activeStage, onStageChange, counts }: StageFilterProps) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className="grid grid-cols-6 gap-1 px-3 py-3 sm:flex sm:items-center sm:gap-2 sm:px-4 sm:overflow-x-auto">
      {stages.map(({ value, label, shortLabel, color }) => {
        const count = value === 'all' ? total : (counts[value] || 0)
        const isActive = activeStage === value

        return (
          <button
            key={value}
            onClick={() => onStageChange(value)}
            className={cn(
              'flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-3 py-2 sm:py-1.5 rounded-lg sm:rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all',
              isActive
                ? `${color} text-white`
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            )}
          >
            {!isActive && <div className={cn('w-2 h-2 rounded-full hidden sm:block', color)} />}
            <span className="sm:hidden">{shortLabel}</span>
            <span className="hidden sm:inline">{label}</span>
            <span className={cn(
              'text-[10px] sm:text-xs px-1 sm:px-1.5 rounded-full',
              isActive ? 'bg-white/20' : 'bg-border'
            )}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
