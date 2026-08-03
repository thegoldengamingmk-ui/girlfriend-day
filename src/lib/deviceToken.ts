/**
 * Device Token Identity System
 * Generates a cryptographically random 32-byte hex token that permanently
 * identifies a device/browser. Stored in both cookies (survives tab closes)
 * and localStorage (backup if cookies are cleared).
 *
 * No login, no email, no Google. The token IS the identity.
 */

const COOKIE_NAME = "device_uid"
const LOCALSTORAGE_KEY = "device_uid_backup"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year in seconds

/**
 * Generate a cryptographically random 32-byte hex string
 */
function generateCryptoToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Read a cookie value by name
 */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.split("=")[1]) : null
}

/**
 * Write a long-lived cookie
 */
function setCookie(name: string, value: string, maxAge: number): void {
  if (typeof document === "undefined") return
  const isSecure =
    typeof window !== "undefined" && window.location.protocol === "https:"
  const secureFlag = isSecure ? "; Secure" : ""
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; SameSite=Lax; Path=/${secureFlag}`
}

/**
 * Get or Create Device Token
 *
 * Priority order:
 * 1. Cookie (primary storage)
 * 2. localStorage backup (if cookie was cleared)
 * 3. Generate brand new token (first visit)
 *
 * Always syncs cookie + localStorage together.
 */
export function getOrCreateDeviceToken(): string {
  // 1. Try cookie first
  let token = getCookie(COOKIE_NAME)

  if (!token) {
    // 2. Try localStorage backup
    try {
      token = localStorage.getItem(LOCALSTORAGE_KEY)
    } catch {
      token = null
    }
  }

  if (!token) {
    // 3. Generate brand-new cryptographic token
    token = generateCryptoToken()
    console.log("[DeviceToken] New device token generated:", token.slice(0, 8) + "...")
  } else {
    console.log("[DeviceToken] Existing device token restored:", token.slice(0, 8) + "...")
  }

  // Sync both stores (refresh cookie TTL on every visit)
  setCookie(COOKIE_NAME, token, COOKIE_MAX_AGE)
  try {
    localStorage.setItem(LOCALSTORAGE_KEY, token)
  } catch {
    // localStorage may be blocked in private mode — cookie is sufficient
  }

  return token
}

/**
 * Get the current device token without creating one.
 * Returns null if the user has never visited before (cookies + localStorage cleared).
 */
export function getDeviceToken(): string | null {
  const fromCookie = getCookie(COOKIE_NAME)
  if (fromCookie) return fromCookie
  try {
    return localStorage.getItem(LOCALSTORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * Check if this is a returning visitor (has an existing device token)
 */
export function isReturningVisitor(): boolean {
  return getDeviceToken() !== null
}
