import {
  checkSuperAdminExists,
  createInitialSuperAdmin,
} from "./adminAuthService"

/**
 * Deployment Seed Function for Database initialization
 * Triggered automatically during deployment or via `npm run seed-admin`
 */
export async function seedInitialAdmin() {
  console.log("[SEED] Checking Super Admin account status...")
  if (checkSuperAdminExists()) {
    console.log("[SEED] Super Admin already exists in database. Skipping seed.")
    return
  }

  try {
    const defaultSuperAdmin = await createInitialSuperAdmin(
      "Website Owner",
      "superadmin@couplegift.com",
      "Owner#2026!MasterPass",
    )
    console.log(
      `[SEED] Successfully created initial Super Admin: ${defaultSuperAdmin.email}`,
    )
  } catch (err) {
    console.error("[SEED] Failed to seed initial Super Admin:", err)
  }
}
