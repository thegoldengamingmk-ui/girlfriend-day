/**
 * Supabase Edge Function: verify-razorpay-payment
 * Verifies Razorpay payment signature server-side using HMAC-SHA256.
 * Signature mismatch = payment NOT marked as successful.
 *
 * POST body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Response:  { success: boolean, message: string }
 */

// Read from env secrets (set via Supabase dashboard Settings > Edge Functions)
// Fallback to test credential if secrets not yet configured
const RAZORPAY_KEY_SECRET =
  Deno.env.get("RAZORPAY_KEY_SECRET") ?? "qSQAVuY97b8XHk5z0c0MQVJG"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

async function hmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(message)

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    messageData,
  )
  const hashArray = Array.from(new Uint8Array(signatureBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            "Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    if (!RAZORPAY_KEY_SECRET) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Server configuration error",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    // HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const message = `${razorpay_order_id}|${razorpay_payment_id}`
    const generatedSignature = await hmacSha256(message, RAZORPAY_KEY_SECRET)

    if (generatedSignature !== razorpay_signature) {
      console.warn("[verify-razorpay-payment] Signature mismatch!", {
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
      })
      return new Response(
        JSON.stringify({
          success: false,
          message: "Payment signature verification failed.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    console.log(
      "[verify-razorpay-payment] Signature verified successfully:",
      razorpay_payment_id,
    )

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment verified successfully.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  } catch (err) {
    console.error("[verify-razorpay-payment] Exception:", err)
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  }
})
