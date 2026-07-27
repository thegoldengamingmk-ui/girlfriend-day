import { createClient } from '@supabase/supabase-js'

// Safe accessor for environment variables in Vite / Browser / Node environments
const getEnvVar = (key: string): string => {
  try {
    // 1. Check import.meta.env (Vite standard)
    if (typeof import.meta !== 'undefined' && import.meta?.env?.[key]) {
      return import.meta.env[key] as string
    }
  } catch {
    // ignore
  }

  try {
    // 2. Check process.env (Node / SSR / Define)
    if (typeof process !== 'undefined' && process?.env?.[key]) {
      return process.env[key] as string
    }
  } catch {
    // ignore
  }

  return ''
}

const supabaseUrl =
  getEnvVar('NEXT_PUBLIC_SUPABASE_URL') ||
  getEnvVar('VITE_SUPABASE_URL') ||
  'https://jyrvbriumhxqutxkriyq.supabase.co'

const supabaseAnonKey =
  getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
  getEnvVar('VITE_SUPABASE_ANON_KEY') ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5cnZicml1bWh4cXV0eGtyaXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTM5MDMsImV4cCI6MjEwMDcyOTkwM30.SuD6eopHe1Lnpt3KLrgWdvhUApBxCWVf5GV-n1wlbQU'

const supabaseServiceRoleKey =
  getEnvVar('SUPABASE_SERVICE_ROLE_KEY') ||
  getEnvVar('VITE_SUPABASE_SERVICE_ROLE_KEY') ||
  ''

// Client for public operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client for server-side verification
export const getSupabaseAdmin = () => {
  if (!supabaseServiceRoleKey) {
    return supabase
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey)
}
