
-- Pipeline table for kanban board
CREATE TABLE public.pipeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  github_username TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  stage TEXT NOT NULL DEFAULT 'sourced' CHECK (stage IN ('sourced', 'contacted', 'responded', 'screen', 'offer')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(github_username)
);

ALTER TABLE public.pipeline ENABLE ROW LEVEL SECURITY;

-- Public read/write for now (no auth in this app)
CREATE POLICY "Allow public read pipeline" ON public.pipeline FOR SELECT USING (true);
CREATE POLICY "Allow public insert pipeline" ON public.pipeline FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update pipeline" ON public.pipeline FOR UPDATE USING (true);
CREATE POLICY "Allow public delete pipeline" ON public.pipeline FOR DELETE USING (true);

CREATE TRIGGER update_pipeline_updated_at
  BEFORE UPDATE ON public.pipeline
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
