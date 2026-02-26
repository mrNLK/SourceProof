import { cn } from '@/lib/utils'
import type { Candidate } from '@/types'

interface AvailabilityBadgeProps {
  candidate: Candidate
  compact?: boolean
  className?: string
}

type Availability = 'active' | 'moderate' | 'low'

const styles: Record<Availability, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Active' },
  moderate: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Moderate' },
  low: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: 'Low' },
}

function deriveAvailability(candidate: Candidate): Availability | null {
  const freq = candidate.github_profile?.contribution_patterns?.commit_frequency
  if (!freq) return null
  if (freq === 'daily' || freq === 'weekly') return 'active'
  if (freq === 'monthly') return 'moderate'
  return 'low'
}

export function AvailabilityBadge({ candidate, compact = false, className }: AvailabilityBadgeProps) {
  const availability = deriveAvailability(candidate)
  if (!availability) return null

  const style = styles[availability]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        style.bg,
        style.text,
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        className
      )}
    >
      {style.label}
    </span>
  )
}
