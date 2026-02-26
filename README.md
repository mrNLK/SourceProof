# SourceKit

AI-powered technical sourcing built on GitHub signal, not resumes.

## Features

- **AI Strategy Builder** — generates target repos, poach companies, and EEA signals from a role + company input
- **GitHub Search** — discovers contributors by repo activity, scores with AI, and ranks by fit
- **Availability Signals** — commit recency and activity indicators on every candidate card
- **Company Deep Research** — auto-researches target company tech stack, culture, and competitors
- **Persistent Monitors** — Exa Websets watch repos for new contributors on a schedule
- **Pipeline Management** — kanban board with stages (Sourced → Contacted → Responded → Screen → Offer), tags, notes, and outreach generation
- **Onboarding + Settings** — first-run guide, search context defaults, API configuration, CSV/JSON export, data cleanup

## Tech Stack

- **Frontend**: Vite, React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- **Backend**: Supabase (auth, database, edge functions)
- **APIs**: Exa API (monitors + research), Anthropic Claude (strategy + scoring + outreach), GitHub API (search + profiles)
- **Storage**: localStorage for pipeline, history, settings, and outreach data

## Getting Started

```bash
git clone https://github.com/mrNLK/github-stars.git
cd github-stars
npm install
cp .env.example .env
```

Fill in your `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
EXA_API_KEY=your-exa-key              # monitors + company research
ANTHROPIC_API_KEY=your-anthropic-key   # strategy + scoring + outreach
GITHUB_TOKEN=your-github-token         # search (optional, increases rate limit)
```

Start the dev server:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

## Architecture

The app is a single-page React application with client-side routing.

- **Pages** (`src/pages/`) — SearchPage, ResearchPage, PipelinePage, SettingsPage, ProfilePage
- **Hooks** (`src/hooks/`) — state management via localStorage-backed custom hooks (`useCandidates`, `useSearchHistory`, `useSettings`, `useOutreach`)
- **Services** (`src/services/`) — GitHub API client, outreach generation, CSV/Slack export
- **Scoring** (`src/lib/scoring.ts`) — signal parsing and candidate scoring engine
- **Edge Functions** (`supabase/functions/`) — server-side AI calls for outreach generation and company research (avoids exposing API keys client-side)

All candidate data, search history, and settings persist in `localStorage` under `sourcekit_*` keys. No authentication is required for local development.

## Deploy

Works with any static hosting provider:

```bash
npm run build   # outputs to dist/
```

For Supabase edge functions, deploy with:

```bash
npx supabase functions deploy
```

Recommended: Vercel for the frontend + Supabase for edge functions and database.

## License

MIT
