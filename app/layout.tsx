import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { getAuthenticatedUserId } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

export const metadata: Metadata = {
  title: "IdeaConnect",
  description: "Anchor your ideas. Protect your genius.",
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
  }

  return (
    <ClerkProvider>
      <html lang="en" className={playfair.variable}>
        <body className="bg-slate-950 text-white min-h-screen">
          <GlobalErrorBoundary>
            <Sidebar currentUserId={userId ?? ""} currentHandle={handle ?? ""} />
            <main className="ml-64 min-h-screen">{children}</main>
            <Toaster position="bottom-right" />
          </GlobalErrorBoundary>
        </body>
      </html>
    </ClerkProvider>
  );
}
