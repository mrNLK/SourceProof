import { cn } from '@/lib/utils'
import { getScoreColor } from '@/lib/scoring'

interface ScoreCircleProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { container: 'w-10 h-10', text: 'text-xs', stroke: 3 },
  md: { container: 'w-14 h-14', text: 'text-sm', stroke: 3 },
  lg: { container: 'w-20 h-20', text: 'text-lg', stroke: 4 },
}

export function ScoreCircle({ score, size = 'md', className }: ScoreCircleProps) {
  const { container, text, stroke } = sizes[size]
  const color = getScoreColor(score)
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className={cn('relative flex items-center justify-center', container, className)}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 40 40">
        <circle
          cx="20" cy="20" r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-border"
        />
        <circle
          cx="20" cy="20" r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span
        className={cn('absolute font-bold font-mono', text)}
        style={{ color }}
      >
        {score}
      </span>
    </div>
  )
}
