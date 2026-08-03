-- ==================================================
-- FULL SUPABASE DATABASE SCHEMA
-- Cinematic Romantic Gift Website
-- Reflects actual live database structure
-- ==================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================================================
-- TABLES
-- ==================================================

-- 1. USERS TABLE (Firebase-linked)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  first_name TEXT,
  last_name TEXT,
  profile_photo TEXT,
  provider TEXT,
  email_verified BOOLEAN DEFAULT false,
  referral_code TEXT,
  referral_link TEXT,
  role TEXT DEFAULT 'USER',
  status TEXT DEFAULT 'ACTIVE',
  referred_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_login TIMESTAMPTZ
);

-- 2. USER PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  profile_image TEXT,
  account_status TEXT DEFAULT 'ACTIVE',
  subscription_status TEXT DEFAULT 'FREE',
  subscription_expiry TIMESTAMPTZ,
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  last_login TIMESTAMPTZ,
  last_login_ip TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. SURPRISES TABLE
CREATE TABLE IF NOT EXISTS public.surprises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  creator_device_token TEXT,
  creator_email TEXT,
  creator_user_id TEXT,
  boyfriend_name TEXT,
  girlfriend_name TEXT,
  letter TEXT,
  spotify_url TEXT,
  voice_note_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS surprises_slug_idx ON public.surprises (slug);
CREATE INDEX IF NOT EXISTS surprises_device_token_idx ON public.surprises (creator_device_token);

-- 4. PHOTOS TABLE
CREATE TABLE IF NOT EXISTS public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surprise_id UUID NOT NULL REFERENCES public.surprises(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS photos_surprise_id_pos_idx ON public.photos (surprise_id, position);

-- 5. QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surprise_id UUID NOT NULL REFERENCES public.surprises(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS questions_surprise_id_idx ON public.questions (surprise_id);

-- 6. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  payment_id TEXT UNIQUE NOT NULL,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'PENDING',
  payment_method TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. WALLETS TABLE
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  available_balance NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL,
  transaction_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. REFERRALS TABLE
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_user_id ON public.referrals(referrer_user_id);

-- 10. REFERRAL STATS TABLE
CREATE TABLE IF NOT EXISTS public.referral_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referral_code TEXT UNIQUE NOT NULL,
  total_referrals INTEGER DEFAULT 0,
  total_earnings NUMERIC DEFAULT 0
);

-- 11. WITHDRAWALS TABLE
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  account_details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. ADMINS TABLE
CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'ADMIN',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. ADMIN LOGS TABLE
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. USER LOGIN HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.user_login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  login_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT
);

-- ==================================================
-- ROW LEVEL SECURITY (RLS)
-- ==================================================

ALTER TABLE public.surprises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_login_history ENABLE ROW LEVEL SECURITY;

-- ── PUBLIC (read-only) tables ──────────────────────────────────────────

-- Surprises: public read + public insert (guests create surprises)
CREATE POLICY "Allow public read surprises" ON public.surprises FOR SELECT USING (true);
CREATE POLICY "Allow public insert surprises" ON public.surprises FOR INSERT WITH CHECK (true);
CREATE POLICY "surprises_service_role_all" ON public.surprises FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Photos: public read + public insert (tied to surprise creation)
CREATE POLICY "Allow public read photos" ON public.photos FOR SELECT USING (true);
CREATE POLICY "Allow public insert photos" ON public.photos FOR INSERT WITH CHECK (true);
CREATE POLICY "photos_service_role_all" ON public.photos FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Questions: public insert only (answers protected via service client)
CREATE POLICY "Allow public insert questions" ON public.questions FOR INSERT WITH CHECK (true);
CREATE POLICY "questions_service_role_all" ON public.questions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── USERS ─────────────────────────────────────────────────────────────
-- Public read (display names shown in leaderboards etc.)
CREATE POLICY "Allow public read users" ON public.users FOR SELECT USING (true);
-- anon/authenticated can insert (signup flow)
CREATE POLICY "users_anon_insert" ON public.users FOR INSERT TO anon, authenticated WITH CHECK (true);
-- All mutations: service role only (updates done via Edge Functions)
CREATE POLICY "users_service_role_all" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── USER PROFILES ──────────────────────────────────────────────────────
CREATE POLICY "Allow public read user_profiles" ON public.user_profiles FOR SELECT USING (true);
CREATE POLICY "user_profiles_anon_insert" ON public.user_profiles FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "user_profiles_service_role_all" ON public.user_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── PAYMENTS ──────────────────────────────────────────────────────────
CREATE POLICY "Allow public read payments" ON public.payments FOR SELECT USING (true);
CREATE POLICY "payments_anon_insert" ON public.payments FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "payments_service_role_all" ON public.payments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── WALLETS ───────────────────────────────────────────────────────────
CREATE POLICY "Allow public read wallets" ON public.wallets FOR SELECT USING (true);
CREATE POLICY "wallets_anon_insert" ON public.wallets FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "wallets_service_role_all" ON public.wallets FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── TRANSACTIONS ──────────────────────────────────────────────────────
CREATE POLICY "Allow public read transactions" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "transactions_anon_insert" ON public.transactions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "transactions_service_role_all" ON public.transactions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── REFERRALS ─────────────────────────────────────────────────────────
CREATE POLICY "Allow public read referrals" ON public.referrals FOR SELECT USING (true);
CREATE POLICY "referrals_anon_insert" ON public.referrals FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "referrals_service_role_all" ON public.referrals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── REFERRAL STATS ─────────────────────────────────────────────────────
CREATE POLICY "Allow public read referral_stats" ON public.referral_stats FOR SELECT USING (true);
CREATE POLICY "referral_stats_anon_insert" ON public.referral_stats FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "referral_stats_service_role_all" ON public.referral_stats FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── WITHDRAWALS ────────────────────────────────────────────────────────
CREATE POLICY "Allow public read withdrawals" ON public.withdrawals FOR SELECT USING (true);
CREATE POLICY "withdrawals_anon_insert" ON public.withdrawals FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "withdrawals_service_role_all" ON public.withdrawals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── ADMINS ──────────────────────────────────────────
CREATE POLICY "Allow public read admins" ON public.admins FOR SELECT USING (true);
CREATE POLICY "Allow public insert on admins" ON public.admins FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update on admins" ON public.admins FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on admins" ON public.admins FOR DELETE TO public USING (true);
CREATE POLICY "admins_service_role_all" ON public.admins FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── ADMIN LOGS ──────────────────────────────────────
CREATE POLICY "Allow public select on admin_logs" ON public.admin_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert on admin_logs" ON public.admin_logs FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "admin_logs_service_role_all" ON public.admin_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── USER LOGIN HISTORY ─────────────────────────────────────────────────
CREATE POLICY "user_login_history_anon_insert" ON public.user_login_history FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "user_login_history_service_role_all" ON public.user_login_history FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================================================
-- STORAGE BUCKETS
-- ==================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-notes', 'voice-notes', true)
ON CONFLICT (id) DO NOTHING;

-- Storage: scoped SELECT avoids broad listing while still allowing public reads
CREATE POLICY "Public Read Photos Objects" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'photos');

CREATE POLICY "Public Upload Photos Bucket" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Public Read Voice Notes Objects" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'voice-notes');

CREATE POLICY "Public Upload Voice Notes Bucket" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'voice-notes');
