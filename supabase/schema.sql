-- ==================================================
-- SUPABASE DATABASE SCHEMA
-- Cinematic Romantic Gift Website
-- ==================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SURPRISES TABLE
CREATE TABLE IF NOT EXISTS public.surprises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  boyfriend_name TEXT,
  girlfriend_name TEXT,
  letter TEXT,
  spotify_url TEXT,
  voice_note_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on slug for fast lookups
CREATE INDEX IF NOT EXISTS surprises_slug_idx ON public.surprises (slug);

-- 2. PHOTOS TABLE
CREATE TABLE IF NOT EXISTS public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surprise_id UUID NOT NULL REFERENCES public.surprises(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

-- Create index on surprise_id and position
CREATE INDEX IF NOT EXISTS photos_surprise_id_pos_idx ON public.photos (surprise_id, position);

-- 3. QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surprise_id UUID NOT NULL REFERENCES public.surprises(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL
);

-- Create index on surprise_id
CREATE INDEX IF NOT EXISTS questions_surprise_id_idx ON public.questions (surprise_id);

-- ==================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==================================================

ALTER TABLE public.surprises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Surprises: Public read by slug & insert
CREATE POLICY "Allow public read surprises" ON public.surprises
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert surprises" ON public.surprises
  FOR INSERT WITH CHECK (true);

-- Photos: Public read & insert
CREATE POLICY "Allow public read photos" ON public.photos
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert photos" ON public.photos
  FOR INSERT WITH CHECK (true);

-- Questions: Public insert (questions are read via RPC or service client so answers are protected)
CREATE POLICY "Allow public insert questions" ON public.questions
  FOR INSERT WITH CHECK (true);

-- ==================================================
-- SUPABASE STORAGE BUCKETS SETUP
-- ==================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-notes', 'voice-notes', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for public access & upload
CREATE POLICY "Public Access Photos Bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');

CREATE POLICY "Public Upload Photos Bucket" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Public Access Voice Notes Bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'voice-notes');

CREATE POLICY "Public Upload Voice Notes Bucket" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'voice-notes');
