-- Add user_id to pipeline, watchlist_items, search_history, outreach_history
-- for per-user data isolation. Mirrors the pattern from 20260301900000_add_user_id_to_settings.sql.

-- ============================================================
-- 1. PIPELINE
-- ============================================================

-- Add user_id column
ALTER TABLE public.pipeline
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop the old global unique constraint and replace with per-user unique
ALTER TABLE public.pipeline DROP CONSTRAINT IF EXISTS pipeline_github_username_key;
ALTER TABLE public.pipeline ADD CONSTRAINT pipeline_user_github_unique UNIQUE (user_id, github_username);

-- Replace permissive RLS policies with user-scoped policies
DROP POLICY IF EXISTS "Allow public read pipeline" ON public.pipeline;
DROP POLICY IF EXISTS "Allow public insert pipeline" ON public.pipeline;
DROP POLICY IF EXISTS "Allow public update pipeline" ON public.pipeline;
DROP POLICY IF EXISTS "Allow public delete pipeline" ON public.pipeline;

CREATE POLICY "Users can read own pipeline"
  ON public.pipeline FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pipeline"
  ON public.pipeline FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pipeline"
  ON public.pipeline FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pipeline"
  ON public.pipeline FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 2. WATCHLIST_ITEMS
-- ============================================================

ALTER TABLE public.watchlist_items
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old unique and replace with per-user unique
ALTER TABLE public.watchlist_items DROP CONSTRAINT IF EXISTS watchlist_items_candidate_username_list_name_key;
ALTER TABLE public.watchlist_items ADD CONSTRAINT watchlist_user_candidate_list_unique UNIQUE (user_id, candidate_username, list_name);

DROP POLICY IF EXISTS "Allow public read watchlist_items" ON public.watchlist_items;
DROP POLICY IF EXISTS "Allow public insert watchlist_items" ON public.watchlist_items;
DROP POLICY IF EXISTS "Allow public update watchlist_items" ON public.watchlist_items;
DROP POLICY IF EXISTS "Allow public delete watchlist_items" ON public.watchlist_items;

CREATE POLICY "Users can read own watchlist"
  ON public.watchlist_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watchlist"
  ON public.watchlist_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watchlist"
  ON public.watchlist_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own watchlist"
  ON public.watchlist_items FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. SEARCH_HISTORY
-- ============================================================

ALTER TABLE public.search_history
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Allow public read search_history" ON public.search_history;
DROP POLICY IF EXISTS "Allow public insert search_history" ON public.search_history;
DROP POLICY IF EXISTS "Allow public delete search_history" ON public.search_history;

CREATE POLICY "Users can read own search_history"
  ON public.search_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own search_history"
  ON public.search_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own search_history"
  ON public.search_history FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 4. OUTREACH_HISTORY
-- ============================================================

ALTER TABLE public.outreach_history
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Allow public read outreach_history" ON public.outreach_history;
DROP POLICY IF EXISTS "Allow public insert outreach_history" ON public.outreach_history;
DROP POLICY IF EXISTS "Allow public delete outreach_history" ON public.outreach_history;

CREATE POLICY "Users can read own outreach_history"
  ON public.outreach_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own outreach_history"
  ON public.outreach_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own outreach_history"
  ON public.outreach_history FOR DELETE
  USING (auth.uid() = user_id);
