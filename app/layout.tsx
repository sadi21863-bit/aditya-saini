import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import type { Metadata } from "next";
// FIX #22: Import Inter so --font-inter CSS variable is actually defined
import { Playfair_Display, Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { getAuthenticatedUserId } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const ONBOARDING_EXEMPT = ["/onboarding", "/sign-in", "/sign-up", "/api"];

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

// FIX #22: Inter loaded and exposed as --font-inter CSS variable
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "IdeaConnect",
  description: "Build ideas together in collaborative rooms.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getAuthenticatedUserId();

  let handle: string | null = null;
  if (userId) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { handle: true },
    });
    handle = user?.handle ?? null;

    // Guard: Clerk session exists but no users table row → force onboarding
    if (!user) {
      const heads = await headers();
      const pathname = heads.get("x-pathname") ?? "/";
      if (!ONBOARDING_EXEMPT.some((p) => pathname.startsWith(p))) {
        redirect("/onboarding");
      }
    }
  }

  return (
    <ClerkProvider>
      {/* FIX #22: Apply both font variables to <html> so they cascade everywhere */}
      <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
        <body className="bg-slate-950 text-white min-h-screen">
          <GlobalErrorBoundary>
            <div className="flex min-h-screen">
              <Sidebar currentUserId={userId ?? ""} currentHandle={handle ?? ""} />
              <main className="flex-1 min-h-screen">{children}</main>
            </div>
            <Toaster position="bottom-right" />
          </GlobalErrorBoundary>
        </body>
      </html>
    </ClerkProvider>
  );
}
