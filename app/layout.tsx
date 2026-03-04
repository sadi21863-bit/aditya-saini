// app/layout.tsx
import { ClerkProvider } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import Sidebar from "@/components/Sidebar";
import { Playfair_Display } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

export const metadata = {
  title: "IdeaConnect - Where Ideas Unite",
  description: "Connect, collaborate, and bring your ideas to life",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get current user server-side
  const clerkUser = await currentUser();
  const userId = clerkUser?.id || "user_test_123";

  return (
    <ClerkProvider>
      <html lang="en" className={playfair.variable}>
        <body className="antialiased">
          <div className="flex min-h-screen">
            {/* Sidebar - Fixed on left */}
            <Sidebar currentUserId={userId} />

            {/* Main Content Area */}
            <div className="flex-1 lg:ml-64 transition-all duration-300 min-h-screen">
              {children}
            </div>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
