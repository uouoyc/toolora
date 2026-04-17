import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics } from "@vercel/analytics/next";

import { MicrosoftAnalytics } from "@/components/microsoft-analytics";

import "@/styles/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Toolora",
  description:
    "这是一个免费的在线工具集合，提供各种实用工具，帮助你更高效地完成任务。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="mx-auto flex min-h-full max-w-7xl px-4">
        {children}
        <GoogleAnalytics gaId="G-CM5R2B6NM2" />
        <MicrosoftAnalytics gaId="wb39fj1p36" />
        <Analytics />
      </body>
    </html>
  );
}
