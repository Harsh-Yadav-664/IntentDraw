-- =============================================================================
-- IntentDraw Database Schema
-- =============================================================================
-- Run this in Supabase Dashboard > SQL Editor
-- Or via Supabase CLI: supabase db push
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- PROJECTS TABLE
-- =============================================================================
-- Stores user projects with canvas data and generated code

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Project',
  canvas_data JSONB DEFAULT NULL,
  global_theme TEXT DEFAULT NULL,
  prompt TEXT DEFAULT NULL,
  generated_code TEXT DEFAULT NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user project lookups
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_updated_at ON public.projects(updated_at DESC);
CREATE INDEX idx_projects_public ON public.projects(is_public) WHERE is_public = true;

-- Comment for documentation
COMMENT ON TABLE public.projects IS 'User design projects with canvas state and generated code';
COMMENT ON COLUMN public.projects.canvas_data IS 'JSON array of regions from canvas-store';
COMMENT ON COLUMN public.projects.prompt IS 'User prompt from workflow-store';
COMMENT ON COLUMN public.projects.generated_code IS 'Last generated HTML/CSS output';

-- =============================================================================
-- REGIONS TABLE
-- =============================================================================
-- Stores individual regions within a project (normalized from canvas_data)
-- This enables per-region queries and future region-level features

CREATE TABLE public.regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  region_number INTEGER NOT NULL,
  geometry JSONB NOT NULL,
  intent TEXT DEFAULT NULL,
  lock_state JSONB NOT NULL DEFAULT '{"layout": false, "style": false, "animation": false}',
  generated_code TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique region numbers per project
  CONSTRAINT unique_region_number_per_project UNIQUE (project_id, region_number)
);

-- Index for fast region lookups
CREATE INDEX idx_regions_project_id ON public.regions(project_id);

-- Comment for documentation
COMMENT ON TABLE public.regions IS 'Individual regions within a project';
COMMENT ON COLUMN public.regions.geometry IS 'Shape geometry: {x, y, width, height, type, path?}';
COMMENT ON COLUMN public.regions.lock_state IS 'Lock flags: {layout, style, animation}';

-- =============================================================================
-- GENERATION HISTORY TABLE
-- =============================================================================
-- Stores version history for each region's generated code

CREATE TABLE public.generation_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id UUID NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  generated_code TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  provider TEXT NOT NULL CHECK (provider IN ('gemini', 'groq')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast history lookups
CREATE INDEX idx_generation_history_region_id ON public.generation_history(region_id);
CREATE INDEX idx_generation_history_created_at ON public.generation_history(created_at DESC);

-- Comment for documentation
COMMENT ON TABLE public.generation_history IS 'Version history of generated code per region';
COMMENT ON COLUMN public.generation_history.provider IS 'AI provider used: gemini or groq';

-- =============================================================================
-- USAGE TABLE
-- =============================================================================
-- Tracks daily generation counts for rate limiting

CREATE TABLE public.usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  generation_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One row per user per day
  CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

-- Index for fast usage lookups
CREATE INDEX idx_usage_user_id ON public.usage(user_id);
CREATE INDEX idx_usage_date ON public.usage(date);
CREATE INDEX idx_usage_user_date ON public.usage(user_id, date);

-- Comment for documentation
COMMENT ON TABLE public.usage IS 'Daily generation count per user for rate limiting';
COMMENT ON COLUMN public.usage.generation_count IS 'Number of AI generations used today';

-- =============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================================================
-- Automatically updates updated_at column on row modification

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER set_updated_at_projects
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_regions
  BEFORE UPDATE ON public.regions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_usage
  BEFORE UPDATE ON public.usage
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- Enable RLS on all tables

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PROJECTS RLS POLICIES
-- =============================================================================

-- Users can view their own projects
CREATE POLICY "Users can view own projects"
  ON public.projects
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view public projects (for sharing feature)
CREATE POLICY "Anyone can view public projects"
  ON public.projects
  FOR SELECT
  USING (is_public = true);

-- Users can create their own projects
CREATE POLICY "Users can create own projects"
  ON public.projects
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own projects
CREATE POLICY "Users can update own projects"
  ON public.projects
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own projects
CREATE POLICY "Users can delete own projects"
  ON public.projects
  FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- REGIONS RLS POLICIES
-- =============================================================================
-- Regions inherit access from their parent project

-- Users can view regions of their own projects
CREATE POLICY "Users can view regions of own projects"
  ON public.regions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = regions.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Users can view regions of public projects
CREATE POLICY "Anyone can view regions of public projects"
  ON public.regions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = regions.project_id
      AND projects.is_public = true
    )
  );

-- Users can create regions in their own projects
CREATE POLICY "Users can create regions in own projects"
  ON public.regions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = regions.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Users can update regions in their own projects
CREATE POLICY "Users can update regions in own projects"
  ON public.regions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = regions.project_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = regions.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Users can delete regions in their own projects
CREATE POLICY "Users can delete regions in own projects"
  ON public.regions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = regions.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- =============================================================================
-- GENERATION HISTORY RLS POLICIES
-- =============================================================================
-- Generation history inherits access from regions → projects

-- Users can view generation history of their own projects
CREATE POLICY "Users can view generation history of own projects"
  ON public.generation_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.regions
      JOIN public.projects ON projects.id = regions.project_id
      WHERE regions.id = generation_history.region_id
      AND projects.user_id = auth.uid()
    )
  );

-- Users can view generation history of public projects
CREATE POLICY "Anyone can view generation history of public projects"
  ON public.generation_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.regions
      JOIN public.projects ON projects.id = regions.project_id
      WHERE regions.id = generation_history.region_id
      AND projects.is_public = true
    )
  );

-- Users can create generation history for their own regions
CREATE POLICY "Users can create generation history for own regions"
  ON public.generation_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.regions
      JOIN public.projects ON projects.id = regions.project_id
      WHERE regions.id = generation_history.region_id
      AND projects.user_id = auth.uid()
    )
  );

-- No update policy - generation history is append-only
-- No delete policy - users should not delete history (project cascade handles cleanup)

-- =============================================================================
-- USAGE RLS POLICIES
-- =============================================================================

-- Users can view only their own usage
CREATE POLICY "Users can view own usage"
  ON public.usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own usage records
CREATE POLICY "Users can create own usage"
  ON public.usage
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own usage records
CREATE POLICY "Users can update own usage"
  ON public.usage
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- No delete policy - usage records should persist for analytics

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get or create today's usage record for a user
-- Returns the current generation count
CREATE OR REPLACE FUNCTION public.get_or_create_usage(p_user_id UUID)
RETURNS TABLE (
  usage_id UUID,
  current_count INTEGER
) AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_usage_id UUID;
  v_count INTEGER;
BEGIN
  -- Try to get existing record
  SELECT id, generation_count INTO v_usage_id, v_count
  FROM public.usage
  WHERE user_id = p_user_id AND date = v_today;
  
  -- If no record exists, create one
  IF v_usage_id IS NULL THEN
    INSERT INTO public.usage (user_id, date, generation_count)
    VALUES (p_user_id, v_today, 0)
    RETURNING id, generation_count INTO v_usage_id, v_count;
  END IF;
  
  RETURN QUERY SELECT v_usage_id, v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage and check limit
-- Returns true if increment was successful, false if limit reached
CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id UUID, p_max_generations INTEGER DEFAULT 10)
RETURNS TABLE (
  success BOOLEAN,
  current_count INTEGER,
  remaining INTEGER
) AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_count INTEGER;
BEGIN
  -- Get or create usage record
  SELECT generation_count INTO v_count
  FROM public.usage
  WHERE user_id = p_user_id AND date = v_today;
  
  IF v_count IS NULL THEN
    -- Create new record with count = 1
    INSERT INTO public.usage (user_id, date, generation_count)
    VALUES (p_user_id, v_today, 1);
    
    RETURN QUERY SELECT true, 1, p_max_generations - 1;
  ELSIF v_count >= p_max_generations THEN
    -- Limit reached
    RETURN QUERY SELECT false, v_count, 0;
  ELSE
    -- Increment existing record
    UPDATE public.usage
    SET generation_count = generation_count + 1
    WHERE user_id = p_user_id AND date = v_today
    RETURNING generation_count INTO v_count;
    
    RETURN QUERY SELECT true, v_count, p_max_generations - v_count;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.get_or_create_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_usage(UUID, INTEGER) TO authenticated;

-- =============================================================================
-- CLEANUP FUNCTION (Optional - for maintenance)
-- =============================================================================
-- Delete usage records older than 90 days (run via cron job)

CREATE OR REPLACE FUNCTION public.cleanup_old_usage()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.usage
  WHERE date < CURRENT_DATE - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- VERIFICATION QUERIES (Run these to verify setup)
-- =============================================================================
-- Uncomment and run these to verify the schema is correct:

-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- SELECT * FROM pg_policies WHERE schemaname = 'public';
-- SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace;