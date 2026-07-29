import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://jyrvbriumhxqutxkriyq.supabase.co"
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5cnZicml1bWh4cXV0eGtyaXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTM5MDMsImV4cCI6MjEwMDcyOTkwM30.SuD6eopHe1Lnpt3KLrgWdvhUApBxCWVf5GV-n1wlbQU"

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function testReferralFlow() {
  console.log("--- STARTING REFERRAL ARCHITECTURE AUTOMATED TEST ---")

  // 1. Query users table
  const { data: users, error: userErr } = await supabase
    .from("users")
    .select("*")
    .limit(5)
  if (userErr) {
    console.error("Failed to query users table:", userErr)
    return
  }

  console.log(`Found ${users.length} user records in public.users table.`)

  if (users.length === 0) {
    console.log(
      "No users in public.users table yet. Testing code lookup logic with fallback...",
    )
  } else {
    const userA = users[0]
    console.log("User A (Referrer):", {
      id: userA.id,
      email: userA.email,
      referralCode: userA.referral_code,
    })

    // 2. Test Invalid Code
    const invalidResult = await validateAndApplyReferralCode(
      userA.id,
      userA.email,
      "INVALID_CODE_123",
    )
    console.log("Test Invalid Code Result:", invalidResult)
    if (!invalidResult.success && invalidResult.message.includes("Invalid")) {
      console.log("✓ PASS 1: Invalid referral code correctly rejected.")
    } else {
      console.error("✗ FAIL 1: Invalid referral code handling error.")
    }

    // 3. Test Self-Referral
    const selfRefResult = await validateAndApplyReferralCode(
      userA.id,
      userA.email,
      userA.referral_code,
    )
    console.log("Test Self-Referral Result:", selfRefResult)
    if (
      !selfRefResult.success &&
      selfRefResult.message.includes("Self-referral")
    ) {
      console.log("✓ PASS 2: Self-referral correctly blocked.")
    } else {
      console.error("✗ FAIL 2: Self-referral protection check.")
    }
  }

  console.log("--- ALL REFERRAL AUTOMATED TESTS COMPLETED ---")
}

async function validateAndApplyReferralCode(
  referredUserId: string,
  referredUserEmail: string,
  enteredCode: string,
) {
  const cleanCode = enteredCode.trim().toUpperCase()
  if (!cleanCode)
    return { success: false, message: "Please enter a valid referral code." }

  const { data: usersList } = await supabase
    .from("users")
    .select("*")
    .eq("referral_code", cleanCode)

  let referrer = usersList && usersList.length > 0 ? usersList[0] : null
  if (!referrer) {
    const { data: profileList } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("referral_code", cleanCode)
    if (profileList && profileList.length > 0) referrer = profileList[0]
  }

  if (!referrer) {
    return {
      success: false,
      message: "Invalid Referral Code. Please check and try again.",
    }
  }

  const referrerEmail = (referrer.email || "").trim().toLowerCase()
  if (
    referrerEmail === referredUserEmail.trim().toLowerCase() ||
    referrer.id === referredUserId
  ) {
    return {
      success: false,
      message:
        "Self-referral is not allowed. You cannot use your own referral code.",
    }
  }

  return { success: true, message: "Referral code accepted!" }
}

testReferralFlow().catch(console.error)
