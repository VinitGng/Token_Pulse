-- TokenPulse: Supabase PostgreSQL Enterprise Schema & Initial Migration
-- MITK AI VISION 24H Hackathon (PS-04 — LLM FinOps Dashboard)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Teams Table
CREATE TABLE IF NOT EXISTS public.teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Features Table
CREATE TABLE IF NOT EXISTS public.features (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Model Pricing Registry
CREATE TABLE IF NOT EXISTS public.pricing (
  model_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  input_cost_per_million NUMERIC(12, 6) NOT NULL,
  output_cost_per_million NUMERIC(12, 6) NOT NULL,
  cached_cost_per_million NUMERIC(12, 6) NOT NULL DEFAULT 0.0,
  context_window INTEGER NOT NULL DEFAULT 128000,
  currency TEXT NOT NULL DEFAULT 'USD',
  version TEXT NOT NULL DEFAULT '2026-Q1',
  source TEXT NOT NULL DEFAULT 'Standard Pricing Table',
  verified INTEGER NOT NULL DEFAULT 1,
  last_verified_at TIMESTAMPTZ,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Budgets Table
CREATE TABLE IF NOT EXISTS public.budgets (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('team', 'feature')),
  entity_id TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('daily', 'monthly', 'total')),
  limit_usd NUMERIC(12, 4) NOT NULL,
  alert_threshold NUMERIC(5, 4) NOT NULL DEFAULT 0.80,
  enforcement_mode TEXT NOT NULL DEFAULT 'monitor' CHECK (enforcement_mode IN ('monitor', 'enforce')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Telemetry Requests Table
CREATE TABLE IF NOT EXISTS public.requests (
  id TEXT PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  iso_timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  team TEXT NOT NULL,
  feature TEXT NOT NULL,
  user_id TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'simulated',
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL,
  prompt_cost NUMERIC(14, 6) NOT NULL,
  completion_cost NUMERIC(14, 6) NOT NULL,
  cached_cost NUMERIC(14, 6) NOT NULL DEFAULT 0.0,
  total_cost NUMERIC(14, 6) NOT NULL,
  latency_ms INTEGER NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 200,
  is_stream INTEGER NOT NULL DEFAULT 0,
  is_simulated INTEGER NOT NULL DEFAULT 1,
  usage_source TEXT NOT NULL DEFAULT 'simulated',
  pricing_version TEXT NOT NULL DEFAULT '2026-Q1',
  prompt_preview TEXT,
  response_preview TEXT,
  raw_metadata JSONB DEFAULT '{}'::jsonb
);

-- High-performance Telemetry Indexes
CREATE INDEX IF NOT EXISTS idx_supabase_requests_timestamp ON public.requests(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_supabase_requests_team ON public.requests(team);
CREATE INDEX IF NOT EXISTS idx_supabase_requests_feature ON public.requests(feature);
CREATE INDEX IF NOT EXISTS idx_supabase_requests_model ON public.requests(model);
CREATE INDEX IF NOT EXISTS idx_supabase_requests_provider ON public.requests(provider);
CREATE INDEX IF NOT EXISTS idx_supabase_requests_user ON public.requests(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- Anonymous Read Policies for Dashboard Viewers
CREATE POLICY "Allow public read access to requests" ON public.requests FOR SELECT USING (true);
CREATE POLICY "Allow public read access to pricing" ON public.pricing FOR SELECT USING (true);
CREATE POLICY "Allow public read access to budgets" ON public.budgets FOR SELECT USING (true);
CREATE POLICY "Allow public read access to teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Allow public read access to features" ON public.features FOR SELECT USING (true);

-- Service Role Full Access Policies
CREATE POLICY "Allow service role write access to requests" ON public.requests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role write access to pricing" ON public.pricing FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role write access to budgets" ON public.budgets FOR ALL TO service_role USING (true) WITH CHECK (true);
