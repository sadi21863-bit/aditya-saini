import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
// import { ClerkProvider } from "@clerk/nextjs"; // ← Disabled for dev
import "./globals.css";
import Sidebar from "@/components/Sidebar";

// ─────────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  weight: ["400", "700", "900"], // Regular, Bold, Black
});

// ─────────────────────────────────────────────────────────────────────────────
// METADATA
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "IdeaConnect | The Genesis Registry",
  description:
    "IP-protected idea sharing platform. Launch, verify, and protect your ideas with cryptographic Genesis Hashes. Built-in plagiarism detection and AI-powered Justice Engine.",
  keywords: [
    "idea sharing",
    "IP protection",
    "genesis hash",
    "plagiarism detection",
    "innovation platform",
    "collaboration",
  ],
  authors: [{ name: "IdeaConnect Team" }],
  creator: "IdeaConnect",
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ROOT LAYOUT (Development Mode - Clerk Disabled)
// ─────────────────────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${playfair.variable} font-sans antialiased bg-[#f8fafb]`}
      >
        {/* Main App Container with Sidebar */}
        <div className="flex min-h-screen">
          {/* Sidebar - Fixed on left */}
          <Sidebar />

          {/* Main Content Area - Responsive margin for sidebar */}
          <div className="flex-1 lg:ml-64 transition-all duration-300 min-h-screen">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
