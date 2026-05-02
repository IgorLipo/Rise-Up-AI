import Link from "next/link";
import { BottomTabBar } from "@/components/nav/bottom-tab-bar";
import { FloatingBack } from "@/components/nav/floating-back";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-full">
      <nav className="hidden md:block sticky top-0 z-50 glass">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="font-display text-lg font-semibold text-amber-700 dark:text-amber-500"
            >
              Statement Reader
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
                  className="px-3 py-1.5 rounded-lg text-sm text-warm-black/60 dark:text-warm-white/40 hover:text-warm-black dark:hover:text-warm-white hover:bg-warm-gray/50 dark:hover:bg-white/5 transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>
      <FloatingBack />
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <BottomTabBar />
    </div>
  );
}
