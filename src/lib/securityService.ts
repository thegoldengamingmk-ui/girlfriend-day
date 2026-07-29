/**
 * Production Security & Rate Limiting Utility Service
 * Provides XSS HTML escaping, client/API rate-limiting, and centralized security audit logging.
 */

import { supabase } from './supabase'

/**
 * XSS HTML Escaping for User-Generated Content
 */
export function escapeHtml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Sanitize User Input Strings
 */
export function sanitizeInput(input: string): string {
  if (!input) return ''
  return escapeHtml(input.trim())
}

/**
 * In-Memory Rate Limiting Tracker
 */
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>()

export function checkRateLimit(actionKey: string, maxLimit = 5, windowMs = 60000): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const key = `ratelimit_${actionKey}`
  const record = rateLimitMap.get(key)

  if (!record || now > record.expiresAt) {
    rateLimitMap.set(key, { count: 1, expiresAt: now + windowMs })
    return { allowed: true, remaining: maxLimit - 1 }
  }

  if (record.count >= maxLimit) {
    return { allowed: false, remaining: 0 }
  }

  record.count += 1
  return { allowed: true, remaining: maxLimit - record.count }
}

/**
 * Centralized Security Audit Logger
 */
export async function logSecurityEvent(params: {
  event: string
  userId?: string
  email?: string
  ipAddress?: string
  details?: string
  status?: 'SUCCESS' | 'WARNING' | 'VIOLATION'
}) {
  const { event, userId, email, ipAddress = '127.0.0.1', details = '', status = 'SUCCESS' } = params
  const nowIso = new Date().toISOString()

  console.log(`[SECURITY AUDIT LOG] Event: ${event} | Status: ${status} | User: ${email || userId || 'Guest'} | Details: ${details}`)

  try {
    await supabase.from('user_login_history').insert([
      {
        user_id: userId && userId.includes('-') ? userId : undefined,
        email: email || 'anonymous@security.log',
        login_time: nowIso,
        ip_address: ipAddress,
        device: `Security Event: ${event} (${status})`,
        browser: details.substring(0, 100),
      },
    ])
  } catch (err) {
    console.warn('[Security Log Warning]:', err)
  }
}
