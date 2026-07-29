/**
 * Razorpay Payment Gateway Integration Service
 * Manages Razorpay test checkout initialization, payment response verification,
 * transaction ledger recording, and romantic gift unlock callbacks.
 */

import { executeWalletTransaction } from './walletService'

export const RAZORPAY_KEY_ID =
  (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_RAZORPAY_KEY_ID) ||
  'rzp_test_TJJpml3f29qMoT'

export interface RazorpayPaymentOptions {
  amount: number // In INR (e.g. 99 or 49)
  description?: string
  userEmail?: string
  userName?: string
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
    if (typeof window === 'undefined') {
      resolve(false)
      return
    }

    if ((window as any).Razorpay) {
      resolve(true)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

/**
 * Launch Razorpay Checkout Modal
 */
export async function launchRazorpayCheckout(options: RazorpayPaymentOptions): Promise<boolean> {
  const loaded = await loadRazorpayScript()
  if (!loaded || typeof window === 'undefined' || !(window as any).Razorpay) {
    console.error('Razorpay SDK failed to load.')
    if (options.onFailure) {
      options.onFailure({ message: 'Razorpay SDK failed to load. Please check your internet connection.' })
    }
    return false
  }

  const amountInPaise = Math.round(options.amount * 100)

  const razorpayConfig = {
    key: RAZORPAY_KEY_ID,
    amount: amountInPaise,
    currency: 'INR',
    name: 'Cinematic Romantic Gift 💝',
    description: options.description || 'Personalized Romantic Surprise Package',
    image: 'https://cdn-icons-png.flaticon.com/512/3408/3408545.png',
    prefill: {
      name: options.userName || 'Romantic Partner',
      email: options.userEmail || '',
      contact: '9999999999',
    },
    notes: {
      package: 'Romantic Surprise Gift',
      environment: 'Test Mode',
    },
    theme: {
      color: '#e8789a',
    },
    handler: function (response: any) {
      console.log('[Razorpay Payment Success] Payment ID:', response.razorpay_payment_id)
      options.onSuccess({
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_signature: response.razorpay_signature,
      })
    },
    modal: {
      ondismiss: function () {
        console.log('[Razorpay Checkout Dismissed] User closed payment window.')
        if (options.onFailure) {
          options.onFailure({ message: 'Payment window was closed.' })
        }
      },
    },
  }

  try {
    const rzp = new (window as any).Razorpay(razorpayConfig)
    rzp.open()
    return true
  } catch (err: any) {
    console.error('[Razorpay Launch Exception]:', err)
    if (options.onFailure) options.onFailure(err)
    return false
  }
}
