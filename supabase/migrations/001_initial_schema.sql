-- SignOff MVP Initial Schema (Supabase PostgreSQL)
-- Aligned with docs/DATABASE_SCHEMA.md & docs/SECURITY_AND_AUTH.md

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  client_name text,
  share_token text UNIQUE NOT NULL,
  passcode_hash text,
  contract_config jsonb, -- Phase 2 Hook: { contractAmountIdr, includedRevisionRounds, extraRoundPriceIdr }
  review_due_at timestamptz,
  owner_last_viewed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects (owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_share_token ON public.projects (share_token);

-- 2. Owner Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_name text CHECK (studio_name IS NULL OR length(trim(studio_name)) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Design Versions
CREATE TABLE IF NOT EXISTS public.design_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_number int NOT NULL CHECK (version_number >= 1),
  round_number int NOT NULL DEFAULT 0, -- Phase 2 Hook
  label text NOT NULL,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'in_review'
    CHECK (status IN ('in_review', 'changes_requested', 'approved')),
  approved_by_name text,
  approved_at timestamptz,
  approval_statement text,
  approval_method text CHECK (approval_method IS NULL OR approval_method IN ('client_link', 'owner_recorded')),
  approval_source text CHECK (approval_source IS NULL OR approval_source IN ('whatsapp', 'email', 'meeting', 'other')),
  approval_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version_number),
  CHECK ((status = 'approved') = (approval_method IS NOT NULL)),
  CHECK (approval_source IS NULL OR approval_method = 'owner_recorded')
);

CREATE INDEX IF NOT EXISTS idx_design_versions_project_id ON public.design_versions (project_id);

-- 4. Design Frames
CREATE TABLE IF NOT EXISTS public.design_frames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.design_versions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) >= 1),
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'pdf_page', 'video')), -- Phase 3 Hook
  image_path text NOT NULL,
  width_px int NOT NULL CHECK (width_px > 0),
  height_px int NOT NULL CHECK (height_px > 0),
  frame_meta jsonb, -- Phase 3 Hook
  sort_order int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_design_frames_version_id ON public.design_frames (version_id);
CREATE INDEX IF NOT EXISTS idx_design_frames_project_id ON public.design_frames (project_id);

-- 5. Pins
CREATE TABLE IF NOT EXISTS public.pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  frame_id uuid NOT NULL REFERENCES public.design_frames(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  pin_number int NOT NULL CHECK (pin_number >= 1),
  kind text NOT NULL DEFAULT 'point' CHECK (kind IN ('point', 'box')),
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('copy', 'layout', 'visual', 'bug', 'general')),
  x_norm double precision NOT NULL CHECK (x_norm >= 0 AND x_norm <= 1),
  y_norm double precision NOT NULL CHECK (y_norm >= 0 AND y_norm <= 1),
  w_norm double precision CHECK (w_norm IS NULL OR (w_norm >= 0 AND w_norm <= 1)),
  h_norm double precision CHECK (h_norm IS NULL OR (h_norm >= 0 AND h_norm <= 1)),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  scope_status text NOT NULL DEFAULT 'in_scope' CHECK (scope_status IN ('in_scope', 'out_of_scope')), -- Phase 2 Hook
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'internal_team')), -- Phase 4 Hook
  client_meta jsonb,
  author_name text NOT NULL,
  author_role text NOT NULL CHECK (author_role IN ('owner', 'client')),
  author_session_id uuid,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (frame_id, pin_number),
  CHECK ((kind = 'box') = (w_norm IS NOT NULL AND h_norm IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_pins_frame_id ON public.pins (frame_id);
CREATE INDEX IF NOT EXISTS idx_pins_project_id ON public.pins (project_id);

-- 6. Pin Comments
CREATE TABLE IF NOT EXISTS public.pin_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id uuid NOT NULL REFERENCES public.pins(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_role text NOT NULL CHECK (author_role IN ('owner', 'client')),
  author_session_id uuid,
  body text NOT NULL,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (deleted_at IS NOT NULL OR length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_pin_comments_pin_id ON public.pin_comments (pin_id);
CREATE INDEX IF NOT EXISTS idx_pin_comments_project_id ON public.pin_comments (project_id);

-- 7. Project Activity
CREATE TABLE IF NOT EXISTS public.project_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_name text NOT NULL,
  action_type text NOT NULL CHECK (
    action_type IN (
      'version_uploaded',
      'pin_created',
      'feedback_submitted',
      'pin_status_changed',
      'pin_resolved',
      'pin_deleted',
      'comment_added',
      'comment_deleted',
      'changes_requested',
      'version_approved',
      'share_token_rotated',
      'project_archived',
      'project_unarchived'
    )
  ),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_activity_project_id ON public.project_activity (project_id, created_at DESC);

-- 8. Rate-Limit Ledger for /api/review/[token]/join
CREATE TABLE IF NOT EXISTS public.join_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  ip_hash text NOT NULL,
  success boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_join_attempts_lookup
  ON public.join_attempts (project_id, ip_hash, attempted_at DESC);

-- 9. Atomic Pin Numbering + Initial Comment RPC
CREATE OR REPLACE FUNCTION public.create_pin(
  p_frame_id uuid,
  p_kind text,
  p_category text,
  p_x_norm double precision,
  p_y_norm double precision,
  p_w_norm double precision,
  p_h_norm double precision,
  p_client_meta jsonb,
  p_author_name text,
  p_author_role text,
  p_author_session_id uuid,
  p_submitted_at timestamptz,
  p_body text
)
RETURNS TABLE (pin_id uuid, pin_number int, comment_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_next_number int;
  v_pin_id uuid;
  v_comment_id uuid;
BEGIN
  -- Row lock prevents concurrent duplicate pin numbers on the same frame
  SELECT df.project_id INTO v_project_id
  FROM public.design_frames df
  WHERE df.id = p_frame_id
  FOR UPDATE;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'FRAME_NOT_FOUND';
  END IF;

  SELECT COALESCE(MAX(p.pin_number), 0) + 1 INTO v_next_number
  FROM public.pins p
  WHERE p.frame_id = p_frame_id;

  INSERT INTO public.pins (
    frame_id, project_id, pin_number, kind, category,
    x_norm, y_norm, w_norm, h_norm,
    client_meta, author_name, author_role, author_session_id, submitted_at
  )
  VALUES (
    p_frame_id, v_project_id, v_next_number, p_kind, p_category,
    p_x_norm, p_y_norm, p_w_norm, p_h_norm,
    p_client_meta, p_author_name, p_author_role, p_author_session_id, p_submitted_at
  )
  RETURNING id INTO v_pin_id;

  INSERT INTO public.pin_comments (
    pin_id, project_id, author_name, author_role, author_session_id, body
  )
  VALUES (
    v_pin_id, v_project_id, p_author_name, p_author_role, p_author_session_id, p_body
  )
  RETURNING id INTO v_comment_id;

  RETURN QUERY SELECT v_pin_id, v_next_number, v_comment_id;
END;
$$;

-- Restrict direct anon/authenticated RPC execution; Route Handlers call via service_role
REVOKE ALL ON FUNCTION public.create_pin(
  uuid, text, text, double precision, double precision, double precision, double precision,
  jsonb, text, text, uuid, timestamptz, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_pin(
  uuid, text, text, double precision, double precision, double precision, double precision,
  jsonb, text, text, uuid, timestamptz, text
) TO service_role;

-- 10. Row-Level Security (RLS)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pin_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.join_attempts ENABLE ROW LEVEL SECURITY;

-- Profiles: owner reads/updates own row only
CREATE POLICY "profiles_owner_all" ON public.profiles
  FOR ALL TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Projects: owner manages own projects only
CREATE POLICY "projects_owner_all" ON public.projects
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Child tables: scoped via denormalized project_id (or version->project for design_versions)
CREATE POLICY "design_versions_owner_all" ON public.design_versions
  FOR ALL TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));

CREATE POLICY "design_frames_owner_all" ON public.design_frames
  FOR ALL TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));

CREATE POLICY "pins_owner_all" ON public.pins
  FOR ALL TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));

CREATE POLICY "pin_comments_owner_all" ON public.pin_comments
  FOR ALL TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));

CREATE POLICY "project_activity_owner_all" ON public.project_activity
  FOR ALL TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));

-- Note: join_attempts intentionally has NO policies (service_role admin client only).
-- Note: Do NOT add tables to supabase_realtime; live guest updates use server-sent Broadcast.

-- 11. Storage Bucket Setup (Private bucket; short-lived signed URLs issued server-side)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'design-assets',
  'design-assets',
  false,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "design_assets_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'design-assets'
    AND (storage.foldername(name))[1] = 'projects'
    AND (storage.foldername(name))[2]::uuid IN (
      SELECT id FROM public.projects WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'design-assets'
    AND (storage.foldername(name))[1] = 'projects'
    AND (storage.foldername(name))[2]::uuid IN (
      SELECT id FROM public.projects WHERE owner_id = auth.uid()
    )
  );
