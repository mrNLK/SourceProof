import { cn } from '@/lib/utils'

interface TagFilterProps {
  allTags: string[]
  activeTags: string[]
  onToggleTag: (tag: string) => void
}

export function TagFilter({ allTags, activeTags, onToggleTag }: TagFilterProps) {
  if (allTags.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto">
      <span className="text-xs text-muted-foreground shrink-0">Tags:</span>
      {allTags.map(tag => (
        <button
          key={tag}
          onClick={() => onToggleTag(tag)}
          className={cn(
            'px-2 py-0.5 rounded-full text-xs font-mono transition-colors whitespace-nowrap',
            activeTags.includes(tag)
              ? 'bg-primary/20 text-primary'
              : 'bg-secondary text-muted-foreground hover:text-foreground'
          )}
        >
          #{tag}
        </button>
      ))}
    </div>
  )
}
