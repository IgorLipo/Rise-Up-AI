import type { Metadata } from "next";
import { Playfair_Display, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Statement Reader — Understand your bank statements, instantly",
  description:
    "Upload bank statements in PDF or CSV. Get instant cash flow analysis, spending insights, and AI-powered financial forecasts.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <Toaster position="top-center" />
        {children}
      </body>
    </html>
  );
}
