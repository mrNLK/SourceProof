
-- Tighten INSERT/UPDATE to service role only
DROP POLICY IF EXISTS "Allow service insert" ON public.candidates;
DROP POLICY IF EXISTS "Allow service update" ON public.candidates;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'candidates' AND policyname = 'Service role insert') THEN
    CREATE POLICY "Service role insert" ON public.candidates FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'candidates' AND policyname = 'Service role update') THEN
    CREATE POLICY "Service role update" ON public.candidates FOR UPDATE
      USING (auth.role() = 'service_role');
  END IF;
END $$;
