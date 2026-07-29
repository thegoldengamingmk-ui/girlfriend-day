-- ====================================================================
-- SUPABASE COMPLETE IDEMPOTENT DATABASE MIGRATION SCHEMA
-- Single Source of Truth for Users, Referral Stats, Wallets, Withdrawals, Transactions, and Payments
-- ====================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Primary Users Table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  first_name TEXT,
  last_name TEXT,
  profile_photo TEXT,
  provider TEXT DEFAULT 'google',
  email_verified BOOLEAN DEFAULT TRUE,
  referral_code TEXT UNIQUE NOT NULL,
  referral_link TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ DEFAULT NOW()
);

-- Backward compatibility view / fallback table mapping
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  profile_image TEXT,
  account_status TEXT DEFAULT 'ACTIVE',
  subscription_status TEXT DEFAULT 'PREMIUM',
  subscription_expiry TIMESTAMPTZ,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT,
  last_login TIMESTAMPTZ,
  last_login_ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Referral Statistics Table
CREATE TABLE IF NOT EXISTS public.referral_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  total_referrals INT DEFAULT 0,
  successful_referrals INT DEFAULT 0,
  pending_referrals INT DEFAULT 0,
  referral_earnings NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Wallets Table
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  available_balance NUMERIC DEFAULT 0,
  pending_balance NUMERIC DEFAULT 0,
  total_earned NUMERIC DEFAULT 0,
  total_withdrawn NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Referrals Activity Table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  referrer_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  referral_code_used TEXT NOT NULL,
  commission_amount NUMERIC DEFAULT 10,
  status TEXT DEFAULT 'APPROVED',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Withdrawals Requests Table (Controlled Approval Workflow)
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id TEXT UNIQUE NOT NULL,
  request_id TEXT,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  payment_method TEXT DEFAULT 'UPI',
  payment_details TEXT,
  upi_id TEXT,
  status TEXT DEFAULT 'PENDING',
  admin_notes TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. User Login History Table
CREATE TABLE IF NOT EXISTS public.user_login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  login_time TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  device TEXT,
  browser TEXT
);

-- 7. Financial Transactions Ledger Table (Source of Truth for Wallet Balances)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  balance_before NUMERIC DEFAULT 0,
  balance_after NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Completed',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Razorpay Payments Ledger Table (Verified Payments)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'Captured',
  payment_method TEXT DEFAULT 'CARD/UPI',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON public.users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_stats_user_id ON public.referral_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON public.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_withdrawal_id ON public.withdrawals(withdrawal_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_id ON public.transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON public.payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id ON public.payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- 10. Row Level Security (RLS) Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Allow public read/write access for application integration
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public select on users') THEN
    CREATE POLICY "Allow public select on users" ON public.users FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert on users') THEN
    CREATE POLICY "Allow public insert on users" ON public.users FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public update on users') THEN
    CREATE POLICY "Allow public update on users" ON public.users FOR UPDATE USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public select on payments') THEN
    CREATE POLICY "Allow public select on payments" ON public.payments FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert on payments') THEN
    CREATE POLICY "Allow public insert on payments" ON public.payments FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public update on payments') THEN
    CREATE POLICY "Allow public update on payments" ON public.payments FOR UPDATE USING (true);
  END IF;
END $$;
