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
      className={`${playfair.variable} ${jetbrains.variable} h-full antialiased dark bg-zinc-950`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-white">
        <Toaster position="top-center" toastOptions={{
          style: {
            background: "#1a1a1a",
            color: "#faf7f2",
            border: "1px solid rgba(255,255,255,0.08)",
          },
        }} />
        {children}
      </body>
    </html>
  );
}
