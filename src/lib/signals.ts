import type { SignalType } from '../types'

export const SIGNAL_COLORS: Record<SignalType, { bg: string; text: string }> = {
  university: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  company: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  degree: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
  publication: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  conference: { bg: 'bg-pink-500/20', text: 'text-pink-400' },
  open_source: { bg: 'bg-green-500/20', text: 'text-green-400' },
  patent: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  leadership: { bg: 'bg-red-500/20', text: 'text-red-400' },
  experience: { bg: 'bg-teal-500/20', text: 'text-teal-400' },
  skill: { bg: 'bg-indigo-500/20', text: 'text-indigo-400' },
}

export const SOURCE_COLORS = {
  linkedin: { bg: 'bg-blue-600/20', text: 'text-blue-400', label: 'LinkedIn' },
  github: { bg: 'bg-gray-600/20', text: 'text-gray-400', label: 'GitHub' },
  web: { bg: 'bg-zinc-600/20', text: 'text-zinc-400', label: 'Web' },
  exa: { bg: 'bg-violet-600/20', text: 'text-violet-400', label: 'Exa' },
}
