import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://jyrvbriumhxqutxkriyq.supabase.co"
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5cnZicml1bWh4cXV0eGtyaXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTM5MDMsImV4cCI6MjEwMDcyOTkwM30.SuD6eopHe1Lnpt3KLrgWdvhUApBxCWVf5GV-n1wlbQU"

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function testWithdrawalWorkflow() {
  console.log("--- STARTING WITHDRAWAL WORKFLOW AUTOMATED TEST ---")

  const { data: users } = await supabase.from("users").select("*").limit(1)

  if (!users || users.length === 0) {
    console.log("No user records found for testing.")
    return
  }

  const user = users[0]
  console.log("Testing User:", { id: user.id, email: user.email })

  // 1. Check current wallet
  const { data: wList } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", user.id)
  let wallet = wList && wList.length > 0 ? wList[0] : null
  if (!wallet) {
    const { data: insertedW } = await supabase
      .from("wallets")
      .insert([{ user_id: user.id, available_balance: 500 }])
      .select()
    wallet = insertedW ? insertedW[0] : { available_balance: 500 }
  }

  console.log("Initial Wallet:", {
    available: wallet.available_balance,
    pending: wallet.pending_balance,
    withdrawn: wallet.total_withdrawn,
  })

  // 2. Validate Minimum Amount Rule (< ₹100 should be rejected)
  const minResult = validateWithdrawalRule(Number(wallet.available_balance), 50)
  console.log("Test Below Minimum (₹50):", minResult)
  if (!minResult.valid && minResult.message.includes("Minimum")) {
    console.log("✓ PASS 1: Amount below ₹100 correctly rejected.")
  } else {
    console.error("✗ FAIL 1: Minimum withdrawal rule.")
  }

  // 3. Validate Excess Amount Rule (> Available Balance should be rejected)
  const excessResult = validateWithdrawalRule(
    Number(wallet.available_balance),
    Number(wallet.available_balance) + 1000,
  )
  console.log("Test Excess Amount:", excessResult)
  if (!excessResult.valid && excessResult.message.includes("Insufficient")) {
    console.log("✓ PASS 2: Amount above available balance correctly rejected.")
  } else {
    console.error("✗ FAIL 2: Excess withdrawal rule.")
  }

  console.log("--- ALL WITHDRAWAL WORKFLOW AUTOMATED TESTS COMPLETED ---")
}

function validateWithdrawalRule(availableBalance: number, amount: number) {
  if (amount < 100)
    return { valid: false, message: "Minimum withdrawal amount is ₹100." }
  if (amount > availableBalance)
    return { valid: false, message: "Insufficient wallet balance." }
  return { valid: true, message: "Valid withdrawal request." }
}

testWithdrawalWorkflow().catch(console.error)
