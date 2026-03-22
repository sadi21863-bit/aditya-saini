import { auth } from "@clerk/nextjs/server";

export async function getAuthenticatedUserId(): Promise<string | null> {
  if (process.env.NODE_ENV === "production") {
    const { userId } = await auth();
    if (userId === "user_test_123") {
      throw new Error("FATAL: Hardcoded dev identity active in production.");
    }
    return userId;
  }
  try {
    const { userId } = await auth();
    return userId;
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<string> {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("Authentication required");
  return userId;
}

export async function isAdmin(): Promise<boolean> {
  try {
    const { sessionClaims } = await auth();
    // Cast metadata to access custom role claim
    const metadata = sessionClaims?.metadata as { role?: string } | undefined;
    return metadata?.role === "admin";
  } catch {
    return false;
  }
}

export async function requireAdmin(): Promise<void> {
  const adminStatus = await isAdmin();
  if (!adminStatus) throw new Error("Admin access required");
}


