import Link from "next/link";
import { BottomTabBar } from "@/components/nav/bottom-tab-bar";
import { FloatingBack } from "@/components/nav/floating-back";
import { CompanySelector } from "@/components/nav/company-selector";
import { LogoutButton } from "@/components/nav/logout-button";
import { NavProgress } from "@/components/nav/nav-progress";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-full bg-zinc-50">
      <NavProgress />
      <nav className="hidden md:block sticky top-0 z-50 bg-white border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="font-display text-lg font-bold text-zinc-900 tracking-tight"
            >
              Cashflow
            </Link>
            <div className="flex items-center gap-1">
              {[
                { href: "/dashboard", label: "Dashboard" },
                { href: "/forecast", label: "Forecast" },
                { href: "/transactions", label: "Transactions" },
                { href: "/history", label: "History" },
                { href: "/upload", label: "Upload" },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="px-3 py-1.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CompanySelector />
            <LogoutButton />
          </div>
        </div>
      </nav>
      <FloatingBack />
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <BottomTabBar />
    </div>
  );
}
