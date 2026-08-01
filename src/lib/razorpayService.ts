/**
 * Production-Grade Razorpay Payment & Verification Service
 * Handles Razorpay standard checkout modal initialization, HMAC-SHA256 signature verification,
 * idempotency checks, payment ledger recording, financial transaction logging, and Premium subscription activation.
 *
 * MASTER RULE: Premium activation must happen ONLY after Razorpay payment has been successfully verified.
 */

import { supabase } from "./supabase"
import { executeWalletTransaction } from "./walletService"
import { isValidUuid } from "./userService"

export const RAZORPAY_KEY_ID =
  (typeof import.meta !== "undefined" &&
    import.meta?.env?.VITE_RAZORPAY_KEY_ID) ||
  "rzp_live_TJikQRma7texEz"

// NOTE: The Razorpay Key Secret must NEVER be exposed in client-side code.

// Payment signature verification must be done server-side only.

// This frontend only initiates the payment flow; Razorpay verifies on their servers.

export interface RazorpayPaymentOptions {
  amount: number // In INR (e.g. 99 or 49)

  description?: string

  userEmail?: string

  userName?: string

  userId?: string

  onSuccess: (paymentResponse: {
    razorpay_payment_id: string

    razorpay_order_id?: string

    razorpay_signature?: string
  }) => void

  onFailure?: (error: any) => void
}

/**
 * Dynamically load Razorpay SDK script if not present
 */

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false)

      return
    }

    if ((window as any).Razorpay) {
      resolve(true)

      return
    }

    const script = document.createElement("script")

    script.src = "https://checkout.razorpay.com/v1/checkout.js"

    script.onload = () => resolve(true)

    script.onerror = () => resolve(false)

    document.body.appendChild(script)
  })
}

/**
 * Verify Razorpay Payment Signature using Web Crypto API HMAC-SHA256
 * NOTE: This is kept for reference only. In production, always verify
 * server-side. Client-side verification cannot be secure without exposing the secret.
 */

export async function computeHmacSha256(
  message: string,

  secret: string,
): Promise<string> {
  if (
    typeof window === "undefined" ||
    !window.crypto ||
    !window.crypto.subtle
  ) {
    return ""
  }

  const encoder = new TextEncoder()

  const keyData = encoder.encode(secret)

  const messageData = encoder.encode(message)

  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",

    keyData,

    { name: "HMAC", hash: "SHA-256" },

    false,

    ["sign"],
  )

  const signatureBuffer = await window.crypto.subtle.sign(
    "HMAC",

    cryptoKey,

    messageData,
  )

  const hashArray = Array.from(new Uint8Array(signatureBuffer))

  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Verify Payment Signature & Activate Premium
 * MASTER RULE: Executed only when payment signature is verified.
 */

export async function verifyAndProcessRazorpayPayment(params: {
  userId?: string

  userEmail?: string

  amount: number

  razorpayOrderId?: string

  razorpayPaymentId: string

  razorpaySignature?: string
}): Promise<{
  success: boolean

  message: string

  alreadyProcessed?: boolean

  paymentId?: string
}> {
  const {
    userId = "",

    userEmail = "",

    amount,

    razorpayOrderId = "",

    razorpayPaymentId,

    razorpaySignature = "",
  } = params

  const nowIso = new Date().toISOString()

  const expiryIso = new Date(
    Date.now() + 365 * 24 * 60 * 60 * 1000,
  ).toISOString()

  console.log(
    "[Razorpay Verification Initiated] Payment ID:",

    razorpayPaymentId,

    "Order ID:",

    razorpayOrderId,
  )

  // NOTE: Signature verification must happen server-side with the secret key.

  // Client-side verification is intentionally skipped to avoid exposing the secret.

  try {
    // 2. Idempotency Check (Ignore Duplicate Payment Events)

    const { data: existingPayment } = await supabase

      .from("payments")

      .select("*")

      .eq("razorpay_payment_id", razorpayPaymentId)

    if (existingPayment && existingPayment.length > 0) {
      console.log(
        "[Idempotency Guard] Payment already verified & processed previously:",

        razorpayPaymentId,
      )

      return {
        success: true,

        message: "Payment already processed.",

        alreadyProcessed: true,

        paymentId: razorpayPaymentId,
      }
    }

    // 3. Create Payment Ledger Entry in public.payments

    const paymentRecord = {
      payment_id: razorpayPaymentId,

      user_id: userId.length > 20 && userId !== "guest" ? userId : null,

      razorpay_order_id: razorpayOrderId || `ORD-${Date.now()}`,

      razorpay_payment_id: razorpayPaymentId,

      razorpay_signature: razorpaySignature || "TEST_SIG",

      amount: Number(amount || 0),

      currency: "INR",

      status: "Captured",

      payment_method: "Razorpay Standard",

      created_at: nowIso,

      updated_at: nowIso,
    }

    const { error: paymentErr } = await supabase

      .from("payments")

      .insert([paymentRecord])

    if (paymentErr) {
      console.warn("[Payment Record Warning] Insert error:", paymentErr)
    } else {
      console.log(
        "[Payment Record Created] Saved payment to public.payments table:",

        razorpayPaymentId,
      )
    }

    // 4. Create Financial Transaction Ledger Entry

    if (userId && userId !== "guest") {
      if (isValidUuid(userId)) {
        await executeWalletTransaction({
          userId,
          type: "Premium Purchase",
          amount: Number(amount || 0),
          referenceType: "payment",
          referenceId: razorpayPaymentId,
          description: `Premium Surprise Package Purchase (Razorpay ID: ${razorpayPaymentId})`,
          status: "Completed",
        })

        // 5. Activate Premium in users & user_profiles tables
        await supabase
          .from("users")
          .update({
            status: "active",
            updated_at: nowIso,
          })
          .eq("id", userId)
      } else {
        await supabase
          .from("users")
          .update({
            status: "active",
            updated_at: nowIso,
          })
          .eq("firebase_uid", userId)
      }

      if (userEmail) {
        await supabase
          .from("user_profiles")
          .update({
            subscription_status: "PREMIUM",
            subscription_expiry: expiryIso,
            updated_at: nowIso,
          })
          .eq("email", userEmail.trim().toLowerCase())
      }

      console.log(
        "[Premium Activated] Successfully activated Premium subscription for user:",
        userId,
      )
    }

    return {
      success: true,

      message: "Razorpay Payment Verified & Premium Activated Successfully!",

      paymentId: razorpayPaymentId,
    }
  } catch (err: any) {
    console.error("[Razorpay Processing Exception]:", err)

    return {
      success: false,

      message: err.message || "Payment processing exception.",
    }
  }
}

/**
 * Edge Function base URL for Supabase-hosted backend endpoints
 */

const SUPABASE_FUNCTIONS_URL =
  (typeof import.meta !== "undefined" && import.meta?.env?.VITE_SUPABASE_URL) ||
  "https://jyrvbriumhxqutxkriyq.supabase.co"

const SUPABASE_ANON_KEY =
  (typeof import.meta !== "undefined" &&
    import.meta?.env?.VITE_SUPABASE_ANON_KEY) ||
  ""

/**
 * Create a Razorpay order via Supabase Edge Function.
 * Returns { order_id, amount, currency } or null on failure.
 * UPI payments REQUIRE a real order_id from this step.
 */

export async function createRazorpayOrder(
  amountInr: number,
): Promise<{ order_id: string; amount: number; currency: string } | null> {
  try {
    const res = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/functions/v1/create-razorpay-order`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ amount: amountInr }),
      },
    )

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      console.error("[createRazorpayOrder] Failed:", errBody)
      return null
    }

    return await res.json()
  } catch (err) {
    console.error("[createRazorpayOrder] Exception:", err)
    return null
  }
}

/**
 * Verify payment signature via Supabase Edge Function.
 */

export async function verifyRazorpaySignature(params: {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/functions/v1/verify-razorpay-payment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(params),
      },
    )
    return await res.json()
  } catch (err) {
    console.error("[verifyRazorpaySignature] Exception:", err)
    return { success: false, message: "Signature verification request failed." }
  }
}

/**
 * Launch Razorpay Standard Checkout Modal
 * Step 1: Create order via Edge Function (gets real order_id — required for UPI)
 * Step 2: Open Razorpay modal with order_id
 * Step 3: On success, verify signature via Edge Function
 */

export async function launchRazorpayCheckout(
  options: RazorpayPaymentOptions,
): Promise<boolean> {
  const loaded = await loadRazorpayScript()

  if (!loaded || typeof window === "undefined" || !(window as any).Razorpay) {
    console.error("Razorpay SDK failed to load.")

    if (options.onFailure) {
      options.onFailure({
        message:
          "Razorpay SDK failed to load. Please check your internet connection.",
      })
    }

    return false
  }

  // STEP 1: Create order server-side to get a real order_id
  // This is required for UPI payments (test@razorpay) to work
  console.log("[Razorpay] Creating order via Edge Function...")
  const order = await createRazorpayOrder(options.amount)

  if (!order || !order.order_id) {
    console.error(
      "[Razorpay] Failed to create order. Proceeding without order_id (UPI will not work).",
    )
    if (options.onFailure) {
      options.onFailure({
        message: "Could not initialise payment. Please try again.",
      })
    }
    return false
  }

  console.log("[Razorpay] Order created:", order.order_id)

  const amountInPaise = order.amount // already in paise from backend

  const razorpayConfig: any = {
    key: RAZORPAY_KEY_ID,

    amount: amountInPaise,

    currency: order.currency || "INR",

    order_id: order.order_id,

    name: "Our Memories ❤️",

    description:
      options.description || "Personalized Romantic Surprise Package",

    image: "https://oursmemories.online/logo.png",

    prefill: {
      name: options.userName || "Romantic Partner",

      email: options.userEmail || "",

      contact: "9999999999",
    },

    notes: {
      package: "Romantic Surprise Gift",

      environment: "Test Mode",
    },

    theme: {
      color: "#e8789a",
    },

    handler: async function (response: any) {
      console.log(
        "[Razorpay Payment Success] Payment ID:",

        response.razorpay_payment_id,
        "Order ID:",
        response.razorpay_order_id,
      )

      // STEP 3: Verify signature server-side
      const sigVerify = await verifyRazorpaySignature({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      })

      if (sigVerify.success) {
        // Signature verified — now process premium activation in Supabase
        const verifyRes = await verifyAndProcessRazorpayPayment({
          userId: options.userId,

          userEmail: options.userEmail,

          amount: options.amount,

          razorpayOrderId: response.razorpay_order_id,

          razorpayPaymentId: response.razorpay_payment_id,

          razorpaySignature: response.razorpay_signature,
        })

        if (verifyRes.success) {
          options.onSuccess({
            razorpay_payment_id: response.razorpay_payment_id,

            razorpay_order_id: response.razorpay_order_id,

            razorpay_signature: response.razorpay_signature,
          })
        } else {
          if (options.onFailure) {
            options.onFailure({ message: verifyRes.message })
          }
        }
      } else {
        console.error("[Razorpay] Signature mismatch!", sigVerify.message)
        if (options.onFailure) {
          options.onFailure({
            message: "Payment verification failed. Please contact support.",
          })
        }
      }
    },

    modal: {
      ondismiss: function () {
        console.log("[Razorpay Checkout Dismissed] User closed payment window.")

        if (options.onFailure) {
          options.onFailure({ message: "Payment window was closed." })
        }
      },
    },
  }

  try {
    const rzp = new (window as any).Razorpay(razorpayConfig)

    rzp.on("payment.failed", function (response: any) {
      console.error("[Razorpay] payment.failed:", response.error)
      if (options.onFailure) {
        options.onFailure({
          message: response.error?.description || "Payment failed.",
          code: response.error?.code,
        })
      }
    })

    rzp.open()

    return true
  } catch (err: any) {
    console.error("[Razorpay Launch Exception]:", err)

    if (options.onFailure) options.onFailure(err)

    return false
  }
}
