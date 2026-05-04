import Link from "next/link";
import { BottomTabBar } from "@/components/nav/bottom-tab-bar";
import { FloatingBack } from "@/components/nav/floating-back";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-full bg-zinc-950">
      <nav className="hidden md:block sticky top-0 z-50">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl border-b border-white/[0.04]" />
        <div className="relative max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="font-display text-lg font-bold text-white tracking-tight"
            >
              Statement<span className="text-amber-400">Reader</span>
            </Link>
            <div className="flex items-center gap-1">
              {[
                { href: "/dashboard", label: "Dashboard" },
                { href: "/insights", label: "Insights" },
                { href: "/history", label: "History" },
                { href: "/upload", label: "Upload" },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="px-3 py-1.5 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/[0.04] transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>
      <FloatingBack />
      <main className="flex-1 pb-20 md:pb-0 relative z-10">{children}</main>
      <BottomTabBar />
    </div>
  );
}
