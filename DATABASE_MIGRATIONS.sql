-- ============================================================================
-- UTTSAV UEPP - Database Schema Fixes and Migrations
-- Execute these queries in order on your Supabase database
-- ============================================================================

-- 1. Fix applications table - Add missing user_id column if not exists
ALTER TABLE public.applications
ADD COLUMN user_id uuid;

-- Add foreign key constraint for user_id
ALTER TABLE public.applications
ADD CONSTRAINT applications_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

-- Create index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);

-- ============================================================================
-- 2. Create extensions for PostGIS (if not already enabled)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- ============================================================================
-- 3. Fix events table - ensure proper PostGIS type
-- ============================================================================
-- Drop existing route_geometry if it exists and recreate with proper type
ALTER TABLE public.events
DROP COLUMN IF EXISTS route_geometry;

ALTER TABLE public.events
ADD COLUMN route_geometry geography(LINESTRING, 4326);

-- Create index for spatial queries
CREATE INDEX IF NOT EXISTS idx_events_route_geometry 
ON public.events USING GIST (route_geometry);

-- ============================================================================
-- 4. Fix master_venues table - ensure proper coordinates type
-- ============================================================================
ALTER TABLE public.master_venues
DROP COLUMN IF EXISTS coordinates;

ALTER TABLE public.master_venues
ADD COLUMN coordinates geography(POINT, 4326);

ALTER TABLE public.master_venues
ADD COLUMN latitude numeric,
ADD COLUMN longitude numeric;

-- Create index for spatial queries
CREATE INDEX IF NOT EXISTS idx_master_venues_coordinates 
ON public.master_venues USING GIST (coordinates);

-- ============================================================================
-- 5. Add missing embedding column to rules_knowledge_base with proper vector type
-- ============================================================================
-- First check if the column exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rules_knowledge_base' AND column_name = 'embedding'
  ) THEN
    ALTER TABLE public.rules_knowledge_base
    ADD COLUMN embedding vector(768) DEFAULT NULL;
  END IF;
END $$;

-- Create index for vector similarity search (safely)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_rules_embedding_hnsw'
  ) THEN
    CREATE INDEX idx_rules_embedding_hnsw 
    ON public.rules_knowledge_base USING hnsw (embedding vector_cosine_ops);
  END IF;
END $$;

-- ============================================================================
-- 6. Add proper columns to users table for authentication
-- ============================================================================
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS password_hash text,
ADD COLUMN IF NOT EXISTS last_login timestamp with time zone,
ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;

-- ============================================================================
-- 7. Improve ai_intelligence_logs table structure
-- ============================================================================
ALTER TABLE public.ai_intelligence_logs
ADD COLUMN IF NOT EXISTS numerical_risk_score integer,
ADD COLUMN IF NOT EXISTS capacity_utilization integer,
ADD COLUMN IF NOT EXISTS exit_safety_rating character varying,
ADD COLUMN IF NOT EXISTS shap_feature_importances jsonb,
ADD COLUMN IF NOT EXISTS ollama_recommendation text;

-- ============================================================================
-- 8. Add compliance tracking to department_routings
-- ============================================================================
ALTER TABLE public.department_routings
ADD COLUMN IF NOT EXISTS compliance_status character varying DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS statutory_requirements jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.users(id);

-- ============================================================================
-- 9. Extend statutory_compliance_data with all required departments
-- ============================================================================
ALTER TABLE public.statutory_compliance_data
ADD COLUMN IF NOT EXISTS police_params jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS fire_params jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS traffic_params jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS municip_params jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS health_params jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS environment_params jsonb DEFAULT '{}'::jsonb;

-- ============================================================================
-- 10. Create index for faster lookups
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_department_routings_status 
ON public.department_routings(status);

CREATE INDEX IF NOT EXISTS idx_applications_status 
ON public.applications(status);

CREATE INDEX IF NOT EXISTS idx_events_start_time 
ON public.events(start_time DESC);

CREATE INDEX IF NOT EXISTS idx_documents_app_id 
ON public.documents(app_id);

CREATE INDEX IF NOT EXISTS idx_audit_trails_app_id 
ON public.audit_trails(app_id);

-- ============================================================================
-- RLS POLICIES - ENABLE ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_routings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statutory_compliance_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_intelligence_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS for users table - Users can only see their own profile
-- ============================================================================
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_insert_self" ON public.users;
CREATE POLICY "users_insert_self" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================================
-- RLS for events table - Users can see events they created
-- ============================================================================
DROP POLICY IF EXISTS "events_select_own" ON public.events;
CREATE POLICY "events_select_own" ON public.events
  FOR SELECT USING (organizer_id = auth.uid());

DROP POLICY IF EXISTS "events_insert_own" ON public.events;
CREATE POLICY "events_insert_own" ON public.events
  FOR INSERT WITH CHECK (organizer_id = auth.uid());

DROP POLICY IF EXISTS "events_update_own" ON public.events;
CREATE POLICY "events_update_own" ON public.events
  FOR UPDATE USING (organizer_id = auth.uid());

-- ============================================================================
-- RLS for applications table - Users can see their own applications
-- ============================================================================
DROP POLICY IF EXISTS "applications_select_own" ON public.applications;
CREATE POLICY "applications_select_own" ON public.applications
  FOR SELECT USING (
    user_id = auth.uid() OR
    event_id IN (
      SELECT id FROM public.events WHERE organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "applications_insert_own" ON public.applications;
CREATE POLICY "applications_insert_own" ON public.applications
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "applications_update_own" ON public.applications;
CREATE POLICY "applications_update_own" ON public.applications
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================================================
-- RLS for documents table - Users can see documents for their applications
-- ============================================================================
DROP POLICY IF EXISTS "documents_select_own" ON public.documents;
CREATE POLICY "documents_select_own" ON public.documents
  FOR SELECT USING (
    app_id IN (
      SELECT app_id FROM public.applications 
      WHERE user_id = auth.uid() OR 
            event_id IN (SELECT id FROM public.events WHERE organizer_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "documents_insert_own" ON public.documents;
CREATE POLICY "documents_insert_own" ON public.documents
  FOR INSERT WITH CHECK (
    app_id IN (
      SELECT app_id FROM public.applications 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS for department_routings - Departments can see their assigned applications
-- ============================================================================
DROP POLICY IF EXISTS "department_routings_select" ON public.department_routings;
CREATE POLICY "department_routings_select" ON public.department_routings
  FOR SELECT USING (true);  -- Simplified - adjust based on department role in metadata

DROP POLICY IF EXISTS "department_routings_update_department" ON public.department_routings;
CREATE POLICY "department_routings_update_department" ON public.department_routings
  FOR UPDATE USING (true);  -- Simplified - adjust based on department role

-- ============================================================================
-- RLS for official_queries - Access control for queries
-- ============================================================================
DROP POLICY IF EXISTS "official_queries_select" ON public.official_queries;
CREATE POLICY "official_queries_select" ON public.official_queries
  FOR SELECT USING (
    official_id = auth.uid() OR
    routing_id IN (
      SELECT id FROM public.department_routings WHERE app_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "official_queries_insert" ON public.official_queries;
CREATE POLICY "official_queries_insert" ON public.official_queries
  FOR INSERT WITH CHECK (official_id = auth.uid());

-- ============================================================================
-- RLS for audit_trails - Audit trails readable by admins and involved parties
-- ============================================================================
DROP POLICY IF EXISTS "audit_trails_select" ON public.audit_trails;
CREATE POLICY "audit_trails_select" ON public.audit_trails
  FOR SELECT USING (
    actor_id = auth.uid() OR
    app_id IN (
      SELECT app_id FROM public.applications WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS for statutory_compliance_data
-- ============================================================================
DROP POLICY IF EXISTS "statutory_compliance_select" ON public.statutory_compliance_data;
CREATE POLICY "statutory_compliance_select" ON public.statutory_compliance_data
  FOR SELECT USING (
    app_id IN (
      SELECT app_id FROM public.applications WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "statutory_compliance_insert" ON public.statutory_compliance_data;
CREATE POLICY "statutory_compliance_insert" ON public.statutory_compliance_data
  FOR INSERT WITH CHECK (
    app_id IN (
      SELECT app_id FROM public.applications WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS for ai_intelligence_logs
-- ============================================================================
DROP POLICY IF EXISTS "ai_logs_select" ON public.ai_intelligence_logs;
CREATE POLICY "ai_logs_select" ON public.ai_intelligence_logs
  FOR SELECT USING (
    app_id IN (
      SELECT app_id FROM public.applications 
      WHERE user_id = auth.uid() OR 
            event_id IN (SELECT id FROM public.events WHERE organizer_id = auth.uid())
    )
  );

-- ============================================================================
-- Verify setup
-- ============================================================================
SELECT 
  tablename,
  COUNT(1) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
