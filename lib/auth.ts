/**
 * lib/auth.ts
 * 
 * Authentication utilities with development mode fallback.
 * Uses Clerk in production, hardcoded test user in development.
 */

// import { auth } from "@clerk/nextjs/server"; // ← Enable for production

/**
 * Get authenticated user ID
 * Returns null if not authenticated
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  // Development mode - always return test user
  return "user_test_123";

  /* Production mode - Enable this when Clerk is ready:
  try {
    const { userId } = await auth();
    return userId;
  } catch (error) {
    console.error("Auth error:", error);
    return null;
  }
  */
}

/**
 * Require authentication - throws if not logged in
 */
export async function requireAuth(): Promise<string> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    throw new Error("Authentication required");
  }

  return userId;
}

/**
 * Check if user is admin
 */
export async function isAdmin(): Promise<boolean> {
  // Development mode - check against known admin IDs
  const userId = await getAuthenticatedUserId();
  const adminIds = ["user_test_123"]; // Add your admin user IDs here
  return userId ? adminIds.includes(userId) : false;

  /* Production mode - Enable this when Clerk is ready:
  try {
    const { sessionClaims } = await auth();
    return sessionClaims?.metadata?.role === "admin";
  } catch (error) {
    return false;
  }
  */
}

/**
 * Require admin role - throws if not admin
 */
export async function requireAdmin(): Promise<void> {
  const adminStatus = await isAdmin();

  if (!adminStatus) {
    throw new Error("Admin access required");
  }
}

/**
 * Get user ID with development fallback
 * Always returns a valid user ID (never null)
 */
export async function getDevUserId(): Promise<string> {
  const userId = await getAuthenticatedUserId();
  return userId || "user_test_123";
}
