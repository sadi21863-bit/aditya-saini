import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import type { Metadata } from "next";
// FIX #22: Import Inter so --font-inter CSS variable is actually defined
import { Playfair_Display, Inter } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/lib/auth";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
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
  const session = await auth();
  const userId = session?.user?.id ?? null;

  let handle: string | null = null;
  if (userId) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { handle: true },
    });
    handle = user?.handle ?? null;

    // Guard: signed-in but no handle (new user or OAuth user) → force onboarding
    if (!user?.handle) {
      const heads = await headers();
      const pathname = heads.get("x-pathname") ?? "/";
      if (!ONBOARDING_EXEMPT.some((p) => pathname.startsWith(p))) {
        redirect("/onboarding");
      }
    }
  }

  return (
    <SessionProvider session={session}>
      <html lang="en" suppressHydrationWarning
        className={`${playfair.variable} ${inter.variable}`}>
        <body className="bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white min-h-screen transition-colors duration-200">
          <ThemeProvider>
            <GlobalErrorBoundary>
              <div className="flex min-h-screen">
                <Sidebar currentUserId={userId ?? ""} currentHandle={handle ?? ""} />
                <main className="flex-1 min-h-screen">{children}</main>
              </div>
              <Toaster position="bottom-right" />
            </GlobalErrorBoundary>
          </ThemeProvider>
        </body>
      </html>
    </SessionProvider>
  );
}
