import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import type { Metadata } from "next";
import { Source_Serif_4, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
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

const ONBOARDING_EXEMPT = ["/onboarding", "/sign-in", "/sign-up", "/api", "/onboarding/welcome"];

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const geist = localFont({
  src: [
    { path: "../node_modules/geist/dist/fonts/geist-sans/Geist-Regular.woff2",  weight: "400" },
    { path: "../node_modules/geist/dist/fonts/geist-sans/Geist-Medium.woff2",   weight: "500" },
    { path: "../node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.woff2", weight: "600" },
    { path: "../node_modules/geist/dist/fonts/geist-sans/Geist-Bold.woff2",     weight: "700" },
  ],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
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
        className={`${sourceSerif.variable} ${geist.variable} ${jetbrainsMono.variable}`}>
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
