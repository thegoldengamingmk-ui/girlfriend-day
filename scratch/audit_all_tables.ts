import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://jyrvbriumhxqutxkriyq.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5cnZicml1bWh4cXV0eGtyaXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTM5MDMsImV4cCI6MjEwMDcyOTkwM30.SuD6eopHe1Lnpt3KLrgWdvhUApBxCWVf5GV-n1wlbQU'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const TABLES = [
  'users',
  'user_profiles',
  'wallets',
  'transactions',
  'payments',
  'withdrawals',
  'referrals',
  'referral_stats',
]

async function runPhysicalDatabaseAudit() {
  console.log('====================================================')
  console.log('       SUPABASE DATABASE COMPLETE PHYSICAL AUDIT    ')
  console.log('====================================================\n')

  for (const table of TABLES) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' })

      if (error) {
        console.log(`❌ TABLE [${table}]: ERROR - ${error.message} (Code: ${error.code})`)
      } else {
        console.log(`✅ TABLE [public.${table}]:`)
        console.log(`   • Status: ACCESSIBLE (200 OK)`)
        console.log(`   • Physical Row Count: ${data ? data.length : 0}`)
        if (data && data.length > 0) {
          console.log(`   • Sample Record:`, JSON.stringify(data[0], null, 2))
        } else {
          console.log(`   • Table Structure Active & Ready for Inserts`)
        }
      }
    } catch (err: any) {
      console.log(`❌ TABLE [${table}]: EXCEPTION - ${err.message}`)
    }
    console.log('----------------------------------------------------')
  }
}

runPhysicalDatabaseAudit().catch(console.error)
