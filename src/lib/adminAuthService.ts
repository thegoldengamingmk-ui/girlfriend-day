import { supabase } from "./supabase"

export interface AdminUser {
  id: string
  name: string
  email: string
  role: "SUPER_ADMIN" | "ADMIN"
  status: "ACTIVE" | "BLOCKED"
  permissions: string[]
  lastLogin: string
  createdAt: string
}

export interface AdminLog {
  id: string
  adminId: string
  adminEmail: string
  action: string
  description: string
  ipAddress: string
  deviceInfo: string
  timestamp: string
}

const ADMIN_SESSION_KEY = "super_admin_session_token"
const SETUP_LOCKED_KEY = "super_admin_setup_permanently_locked"

// ─────────────────────────────────────────────────────────────────────────────
// Password Hashing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SHA-256 Salted Password Hashing (Web Crypto API)
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = "couple_gift_super_admin_salt_2026_v2"
  const encoder = new TextEncoder()
  const data = encoder.encode(password + salt)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Validate Strong Password Rules
 */
export function validatePasswordStrength(
  password: string,
): { isValid: boolean error?: string } {
  if (password.length < 12) {
    return {
      isValid: false,
      error: "Password must be at least 12 characters long.",
    }
  }
  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one uppercase letter (A-Z).",
    }
  }
  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one lowercase letter (a-z).",
    }
  }
  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one number (0-9).",
    }
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one special character (!@#$%...).",
    }
  }
  return { isValid: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Account Queries — Supabase as Primary Source of Truth
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all registered admin accounts from Supabase (primary source)
 */
export async function getRegisteredAdmins(): Promise<AdminUser[]> {
  try {
    const { data: admins, error } = await supabase
      .from("admins")
      .select(
        "id, name, email, role, status, permissions, created_at, updated_at",
      )
      .order("created_at", { ascending: true })

    if (error) {
      console.warn("[getRegisteredAdmins] Supabase error:", error.message)
      return []
    }

    if (admins && admins.length > 0) {
      return admins.map((a) => ({
        id: a.id,
        name: a.name || "",
        email: a.email,
        role: (a.role === "SUPER_ADMIN"
          ? "SUPER_ADMIN"
          : "ADMIN") as "SUPER_ADMIN" | "ADMIN",
        status: (a.status === "BLOCKED"
          ? "BLOCKED"
          : "ACTIVE") as "ACTIVE" | "BLOCKED",
        permissions: (() => {
          try {
            if (Array.isArray(a.permissions)) return a.permissions
            if (typeof a.permissions === "string")
              return JSON.parse(a.permissions)
          } catch {}
          return []
        })(),
        lastLogin: a.updated_at
          ? new Date(a.updated_at).toLocaleString()
          : "Never",
        createdAt: a.created_at
          ? new Date(a.created_at).toISOString()
          : new Date().toISOString(),
      }))
    }
  } catch (err) {
    console.warn("[getRegisteredAdmins error]:", err)
  }
  return []
}

/**
 * Check if any SUPER_ADMIN exists in Supabase
 */
export async function checkSuperAdminExists(): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("admins")
      .select("id")
      .eq("role", "SUPER_ADMIN")
      .limit(1)
    return !!(data && data.length > 0)
  } catch {
    return false
  }
}

/**
 * Permanently Lockout Check for /setup-super-admin
 */
export async function isSetupRoutePermanentlyLocked(): Promise<boolean> {
  if (localStorage.getItem(SETUP_LOCKED_KEY) === "true") return true
  const exists = await checkSuperAdminExists()
  if (exists) {
    localStorage.setItem(SETUP_LOCKED_KEY, "true")
    return true
  }
  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// Super Admin Setup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create the initial SUPER_ADMIN account (one-time setup route)
 */
export async function createInitialSuperAdmin(
  name: string,
  email: string,
  password: string,
): Promise<AdminUser> {
  const locked = await isSetupRoutePermanentlyLocked()
  if (locked) {
    throw new Error(
      "403 Forbidden: Initial Super Admin Setup is Permanently Disabled.",
    )
  }

  const strength = validatePasswordStrength(password)
  if (!strength.isValid) throw new Error(strength.error)

  const hashedPassword = await hashPassword(password)
  const cleanEmail = email.trim().toLowerCase()
  const adminId = `admin_super_${Date.now()}`
  const nowIso = new Date().toISOString()

  const superAdminPermissions = [
    "manage_users",
    "manage_payments",
    "manage_subscriptions",
    "manage_referrals",
    "approve_withdrawals",
    "manage_cms",
    "manage_settings",
    "manage_admins",
    "view_logs",
  ]

  const superAdmin: AdminUser = {
    id: adminId,
    name: name.trim(),
    email: cleanEmail,
    role: "SUPER_ADMIN",
    status: "ACTIVE",
    permissions: superAdminPermissions,
    lastLogin: nowIso,
    createdAt: nowIso,
  }

  // Write to Supabase (primary)
  const { error: insertError } = await supabase.from("admins").insert([
    {
      id: adminId,
      name: superAdmin.name,
      email: cleanEmail,
      password_hash: hashedPassword,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      permissions: JSON.stringify(superAdminPermissions),
      created_at: nowIso,
      updated_at: nowIso,
    },
  ])

  if (insertError) {
    throw new Error(
      `Failed to create Super Admin in database: ${insertError.message}`,
    )
  }

  // Permanently lock setup route
  localStorage.setItem(SETUP_LOCKED_KEY, "true")

  // Create session
  _setAdminSession(superAdmin)

  await logAdminAction(
    superAdmin.id,
    superAdmin.email,
    "SUPER_ADMIN_SETUP",
    "Created initial Super Admin and permanently disabled setup route",
  )

  return superAdmin
}

// ─────────────────────────────────────────────────────────────────────────────
// Staff Admin Management (SUPER_ADMIN only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new Staff Admin — writes to Supabase
 */
export async function createStaffAdmin(
  name: string,
  email: string,
  password: string,
  role: "SUPER_ADMIN" | "ADMIN",
  permissions: string[],
): Promise<AdminUser> {
  const strength = validatePasswordStrength(password)
  if (!strength.isValid) throw new Error(strength.error)

  const hashedPassword = await hashPassword(password)
  const cleanEmail = email.trim().toLowerCase()
  const adminId = `admin_${Date.now()}`
  const nowIso = new Date().toISOString()

  const newAdmin: AdminUser = {
    id: adminId,
    name: name.trim(),
    email: cleanEmail,
    role,
    status: "ACTIVE",
    permissions,
    lastLogin: "Never",
    createdAt: nowIso,
  }

  const { error } = await supabase.from("admins").insert([
    {
      id: adminId,
      name: newAdmin.name,
      email: cleanEmail,
      password_hash: hashedPassword,
      role,
      status: "ACTIVE",
      permissions: JSON.stringify(permissions),
      created_at: nowIso,
      updated_at: nowIso,
    },
  ])

  if (error) throw new Error(`Failed to create admin: ${error.message}`)

  return newAdmin
}

/**
 * Toggle Staff Admin Status — updates Supabase
 */
export async function toggleAdminStatus(adminId: string): Promise<void> {
  try {
    // Get current status from Supabase
    const { data } = await supabase
      .from("admins")
      .select("role, status")
      .eq("id", adminId)
      .single()
    if (!data || data.role === "SUPER_ADMIN") return // Never block SUPER_ADMIN

    const newStatus = data.status === "ACTIVE" ? "BLOCKED" : "ACTIVE"
    await supabase
      .from("admins")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", adminId)
  } catch (err) {
    console.warn("[toggleAdminStatus error]:", err)
  }
}

/**
 * Delete Staff Admin — removes from Supabase (never removes SUPER_ADMIN)
 */
export async function deleteAdminAccount(adminId: string): Promise<void> {
  try {
    const { data } = await supabase
      .from("admins")
      .select("role")
      .eq("id", adminId)
      .single()
    if (!data || data.role === "SUPER_ADMIN") return // Never delete SUPER_ADMIN
    await supabase.from("admins").delete().eq("id", adminId)
  } catch (err) {
    console.warn("[deleteAdminAccount error]:", err)
  }
}

/**
 * Update Admin Password — writes hash to Supabase
 */
export async function updateAdminPassword(
  adminId: string,
  newPassword: string,
): Promise<void> {
  const strength = validatePasswordStrength(newPassword)
  if (!strength.isValid) throw new Error(strength.error)

  const hash = await hashPassword(newPassword)
  const { error } = await supabase
    .from("admins")
    .update({
      password_hash: hash,
      updated_at: new Date().toISOString(),
    })
    .eq("id", adminId)

  if (error) throw new Error(`Failed to update password: ${error.message}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Login & Authentication — Supabase verified
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Admin Login — verifies credentials against Supabase with brute-force protection
 */
export async function verifyAdminLogin(
  email: string,
  password: string,
): Promise<AdminUser> {
  const cleanEmail = email.trim().toLowerCase()
  const inputHash = await hashPassword(password)

  // 1. Fetch admin from Supabase
  const { data: adminRow, error: fetchError } = await supabase
    .from("admins")
    .select(
      "id, name, email, role, status, permissions, password_hash, failed_attempts, locked_until, created_at",
    )
    .eq("email", cleanEmail)
    .single()

  if (fetchError || !adminRow) {
    // Avoid timing attacks — still hash before returning
    throw new Error("Invalid email or password.")
  }

  // 2. Check lockout (server-side)
  const failedAttempts = Number(adminRow.failed_attempts || 0)
  if (adminRow.locked_until && new Date(adminRow.locked_until) > new Date()) {
    const minutesLeft = Math.ceil(
      (new Date(adminRow.locked_until).getTime() - Date.now()) / 60000,
    )
    throw new Error(`Account locked. Try again in ${minutesLeft} minute(s).`)
  }

  // 3. Check status
  if (adminRow.status === "BLOCKED") {
    throw new Error(
      "This admin account has been suspended. Contact the Super Admin.",
    )
  }

  // 4. Verify password hash
  if (adminRow.password_hash !== inputHash) {
    // Increment failed attempts
    const newAttempts = failedAttempts + 1
    const lockedUntil =
      newAttempts >= 5
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : null

    await supabase
      .from("admins")
      .update({
        failed_attempts: newAttempts,
        locked_until: lockedUntil,
        updated_at: new Date().toISOString(),
      })
      .eq("id", adminRow.id)

    const remaining = Math.max(0, 5 - newAttempts)
    throw new Error(
      remaining > 0
        ? `Invalid email or password. ${remaining} attempt(s) remaining.`
        : "Account locked for 15 minutes due to multiple failed login attempts.",
    )
  }

  // 5. Reset failed attempts on successful login
  const nowIso = new Date().toISOString()
  await supabase
    .from("admins")
    .update({
      failed_attempts: 0,
      locked_until: null,
      updated_at: nowIso,
    })
    .eq("id", adminRow.id)

  // 6. Build admin user object
  const admin: AdminUser = {
    id: adminRow.id,
    name: adminRow.name || "",
    email: adminRow.email,
    role: adminRow.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN",
    status: "ACTIVE",
    permissions: (() => {
      try {
        if (Array.isArray(adminRow.permissions)) return adminRow.permissions
        if (typeof adminRow.permissions === "string")
          return JSON.parse(adminRow.permissions)
      } catch {}
      return []
    })(),
    lastLogin: nowIso,
    createdAt: adminRow.created_at
      ? new Date(adminRow.created_at).toISOString()
      : nowIso,
  }

  // 7. Create session
  _setAdminSession(admin)

  await logAdminAction(
    admin.id,
    admin.email,
    "ADMIN_LOGIN",
    "Logged into Admin Panel",
  )

  return admin
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Management
// ─────────────────────────────────────────────────────────────────────────────

function _setAdminSession(admin: AdminUser) {
  const sessionData = {
    user: admin,
    expiresAt: Date.now() + 1000 * 60 * 60 * 12, // 12 hours
    createdAt: Date.now(),
  }
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(sessionData))
}

/**
 * Get active session from localStorage (12h expiry)
 */
export function getActiveAdminSession(): AdminUser | null {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed.expiresAt || parsed.expiresAt < Date.now()) {
      localStorage.removeItem(ADMIN_SESSION_KEY)
      return null
    }
    return parsed.user as AdminUser
  } catch {
    return null
  }
}

/**
 * Logout Session
 */
export async function logoutAdminSession() {
  const session = getActiveAdminSession()
  if (session) {
    await logAdminAction(
      session.id,
      session.email,
      "ADMIN_LOGOUT",
      "Logged out of Admin Panel",
    )
  }
  localStorage.removeItem(ADMIN_SESSION_KEY)
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit Logging
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log administrative activity to Supabase admin_logs table
 */
export async function logAdminAction(
  adminId: string,
  adminEmail: string,
  action: string,
  description: string,
) {
  const deviceInfo =
    typeof navigator !== "undefined"
      ? navigator.userAgent.slice(0, 120)
      : "Server"

  try {
    await supabase.from("admin_logs").insert([
      {
        admin_id: adminId,
        admin_email: adminEmail,
        action,
        description,
        ip_address: "(client-side)",
        device_info: deviceInfo,
        created_at: new Date().toISOString(),
      },
    ])
  } catch (err) {
    console.warn("[logAdminAction error]:", err)
  }
}
