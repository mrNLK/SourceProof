-- Add user_id to settings table for per-user isolation
-- Previously settings were global (key as PK); now scoped per user.

-- 1. Drop existing primary key
ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_pkey;

-- 2. Add user_id column (nullable initially for migration of existing rows)
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Set composite primary key
ALTER TABLE public.settings ADD PRIMARY KEY (user_id, key);

-- 4. Replace permissive RLS policies with user-scoped policies
DROP POLICY IF EXISTS "Allow public read" ON public.settings;
DROP POLICY IF EXISTS "Allow public insert" ON public.settings;
DROP POLICY IF EXISTS "Allow public update" ON public.settings;

CREATE POLICY "Users can read own settings"
  ON public.settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
  ON public.settings FOR DELETE
  USING (auth.uid() = user_id);
