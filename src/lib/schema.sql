-- ====================================================================
-- SUPABASE COMPLETE SUPER ADMIN & USER DATABASE SCHEMA
-- ====================================================================

-- 1. Users Table (User Profiles)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  profile_image TEXT,
  account_status TEXT DEFAULT 'ACTIVE',
  subscription_status TEXT DEFAULT 'FREE',
  subscription_expiry TIMESTAMPTZ,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT,
  last_login TIMESTAMPTZ,
  last_login_ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User Login History
CREATE TABLE IF NOT EXISTS public.user_login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  login_time TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  device TEXT,
  browser TEXT
);

-- 3. Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  user_name TEXT,
  user_email TEXT,
  transaction_id TEXT UNIQUE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  payment_gateway TEXT DEFAULT 'Razorpay',
  payment_status TEXT DEFAULT 'SUCCESS', -- SUCCESS, FAILED, PENDING, REFUNDED
  plan_name TEXT DEFAULT 'Premium Plan',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Subscriptions Table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  plan_name TEXT DEFAULT 'Premium Plan',
  price NUMERIC(10, 2) DEFAULT 49.00,
  status TEXT DEFAULT 'ACTIVE',
  start_date TIMESTAMPTZ DEFAULT NOW(),
  expiry_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 year'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Referrals Table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  commission_amount NUMERIC(10, 2) DEFAULT 10.00,
  status TEXT DEFAULT 'APPROVED', -- PENDING, APPROVED, REJECTED
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Withdrawals Table
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  user_name TEXT,
  user_email TEXT,
  amount NUMERIC(10, 2) NOT NULL,
  payment_method TEXT DEFAULT 'UPI',
  upi_id TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, PAID
  admin_notes TEXT,
  payment_ref_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- 7. Admins Table
CREATE TABLE IF NOT EXISTS public.admins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'ADMIN', -- SUPER_ADMIN, ADMIN
  status TEXT DEFAULT 'ACTIVE',
  permissions JSONB DEFAULT '[]'::jsonb,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Admin Audit Logs Table
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  ip_address TEXT,
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Supabase Realtime for instant updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.referrals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_logs;
