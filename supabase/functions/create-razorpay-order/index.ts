/**
 * Supabase Edge Function: create-razorpay-order
 * Creates a Razorpay order server-side using the KEY_SECRET.
 * The KEY_SECRET never reaches the browser.
 *
 * POST body: { amount: number (INR), currency?: string, receipt?: string }
 * Response:  { order_id, amount, currency }
 */

// Read from env secrets (set via Supabase dashboard Settings > Edge Functions)
// Fallback to test credentials if secrets not yet configured
const RAZORPAY_KEY_ID =
  Deno.env.get("RAZORPAY_KEY_ID") ?? "rzp_test_TJhFwy5s5lGmdx"
const RAZORPAY_KEY_SECRET =
  Deno.env.get("RAZORPAY_KEY_SECRET") ?? "mVmZ2l0PfxvEbfLskn0nQnRe"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const body = await req.json()
    const { amount, currency = "INR", receipt } = body

    // Validate amount (minimum 100 paise = ₹1)
    const amountInPaise = Math.round(Number(amount) * 100)
    if (!amountInPaise || amountInPaise < 100) {
      return new Response(
        JSON.stringify({ error: "Amount must be at least ₹1 (100 paise)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return new Response(
        JSON.stringify({ error: "Razorpay credentials not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    // Call Razorpay Orders API
    const credentials = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)

    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency,
        receipt: receipt || `receipt_${Date.now()}`,
      }),
    })

    if (!razorpayResponse.ok) {
      const errorData = await razorpayResponse.json()
      console.error("[create-razorpay-order] Razorpay API error:", errorData)
      return new Response(
        JSON.stringify({
          error: "Failed to create Razorpay order",
          details: errorData,
        }),
        {
          status: razorpayResponse.status === 401 ? 401 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    const order = await razorpayResponse.json()

    return new Response(
      JSON.stringify({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  } catch (err) {
    console.error("[create-razorpay-order] Exception:", err)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
