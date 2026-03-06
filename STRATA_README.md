# STRATA — Regulatory Intelligence Platform

STRATA is a regtech copilot for regulated, asset-heavy businesses (starting with US utilities and energy developers). It continuously monitors regulatory sources, extracts structured intelligence from new filings, generates cited document updates (redlines, memos, benchmarking matrices), and routes them through a reviewer workflow with full audit trail. The core loop: Parallel Monitor detects changes, STRATA ingests and classifies documents, Parallel Deep Research extracts the "what changed" and "so what," Claude generates redlined updates, and a reviewer approves for versioned publish.

## Architecture

```
Exa Websets (corpus)  →  Parallel Monitor (watch layer)
                            ↓ webhook
                      STRATA Backend (FastAPI + Celery)
                        ├── Ingest: fetch + classify document
                        ├── Extract: Parallel Deep Research
                        ├── Generate: Claude API redline
                        └── Review: approve → versioned publish
                            ↓
                      React Dashboard (reviewer UI)
```

## Prerequisites

- Python 3.11+
- Node 18+
- Redis
- ngrok (for local webhook testing)
- Supabase project
- API keys: Exa, Parallel, Anthropic

## Setup

1. Clone the repo
2. Copy environment files:
   ```
   cp strata/.env.example strata/.env   # fill in all API keys
   ```
3. Install Python dependencies:
   ```
   pip install -r strata/requirements.txt
   ```
4. Run the SQL migration in your Supabase dashboard — paste contents of `strata/migrations/001_initial.sql`
5. Start Redis:
   ```
   make redis
   ```
6. Start the API server (terminal 1):
   ```
   make dev-api
   ```
7. Start the Celery worker (terminal 2):
   ```
   make dev-worker
   ```
8. Seed demo assets:
   ```
   make seed
   ```
9. Initialize the regulatory corpus:
   ```
   make init-corpus
   ```
10. Start ngrok tunnel:
    ```
    make tunnel
    ```
    Copy the ngrok URL, set `BASE_URL` in `.env` to the ngrok URL, restart the API server.
11. Initialize monitors:
    ```
    make init-monitors
    ```
12. Set up the frontend:
    ```
    cd strata-frontend
    npm install
    cp .env.example .env   # set VITE_API_URL to http://localhost:8000
    npm run dev
    ```

## Demo

1. Open the frontend at http://localhost:5173
2. Go to the **Corpus** tab
3. Paste a FERC order URL into the "Trigger Pipeline" field
4. Click "Trigger Pipeline"
5. Within a few minutes, a pending review should appear in the **Review Queue** tab with a redlined memo draft and impacted asset list

## API Docs

FastAPI auto-generated docs: http://localhost:8000/docs
