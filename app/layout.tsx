import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased bg-[#fafafa]`}>
        <div className="flex">
          {/* THE SIDEBAR */}
          <Sidebar />

          {/* THE MAIN CONTENT AREA */}
          <div className="flex-1 lg:ml-64 transition-all duration-300">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}