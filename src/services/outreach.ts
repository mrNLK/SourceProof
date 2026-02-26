import type { Candidate, Settings } from '@/types'

export async function generateOutreach(
  candidate: Candidate,
  settings: Settings,
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<string> {
  if (supabaseUrl && supabaseKey) {
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-outreach`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        candidate: {
          name: candidate.name,
          company: candidate.company,
          role: candidate.role,
          bio: candidate.bio,
          signals: candidate.signals,
        },
        context: {
          target_company: settings.target_company,
          role_title: settings.role_title,
          pitch: settings.one_line_pitch,
        },
      }),
    })

    if (!response.ok) throw new Error('Failed to generate outreach')
    const data = await response.json()
    return data.message
  }

  // Fallback template
  const name = candidate.name.split(' ')[0]
  return `Hey ${name}, I came across your work${candidate.company ? ` at ${candidate.company}` : ''} and was really impressed. We're building ${settings.one_line_pitch || 'something exciting'} at ${settings.target_company || 'our company'} and looking for a ${settings.role_title || 'talented engineer'}. Would love to chat if you're open to it!`
}
