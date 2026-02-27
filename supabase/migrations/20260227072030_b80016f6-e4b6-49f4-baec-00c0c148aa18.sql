-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_candidates_github_username ON public.candidates (github_username);
CREATE INDEX IF NOT EXISTS idx_candidates_fetched_at ON public.candidates (fetched_at);
CREATE INDEX IF NOT EXISTS idx_candidates_score ON public.candidates (score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_pipeline_github_username ON public.pipeline (github_username);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage ON public.pipeline (stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_tags ON public.pipeline USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_pipeline_created_at ON public.pipeline (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON public.search_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_candidate_username ON public.watchlist_items (candidate_username);
CREATE INDEX IF NOT EXISTS idx_settings_key ON public.settings (key);