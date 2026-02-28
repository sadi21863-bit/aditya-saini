import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "IdeaConnect — Share Your Vision",
  description: "A platform to launch, share, and discover ideas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased bg-[#f8fafb]`}>
        <div className="flex">
          <Sidebar />
          <div className="flex-1 lg:ml-64 transition-all duration-300 min-h-screen">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
