"use client";

// Top-of-page navigation progress bar. Shows immediately on Link click
// (gives instant feedback that the user's click registered) and stays
// visible until the next page's effects settle.
//
// Implementation: hooks `next/navigation`'s pathname change. We start
// the bar on click intercepted at window level for any internal Link,
// and end it when pathname actually changes (or after a 1.5s safety
// timeout if a click doesn't lead to navigation).

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function NavProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);

  // End the progress when the pathname changes.
  useEffect(() => {
    if (!active) return;
    setProgress(100);
    const t = setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Click interceptor — start the bar on any internal anchor click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = (e.target as HTMLElement | null)?.closest?.("a");
      if (!target) return;
      const a = target as HTMLAnchorElement;
      if (a.target === "_blank") return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("/")) return;
      if (href === pathname) return;
      setActive(true);
      setProgress(15);
      // Animate up toward 80% while loading.
      const intervals = [
        setTimeout(() => setProgress(40), 150),
        setTimeout(() => setProgress(65), 400),
        setTimeout(() => setProgress(80), 900),
      ];
      // Safety timeout: hide after 4s even if route never changes.
      const safety = setTimeout(() => {
        setActive(false);
        setProgress(0);
      }, 4000);
      // Cleanup
      return () => {
        intervals.forEach(clearTimeout);
        clearTimeout(safety);
      };
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  if (!active) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-transparent pointer-events-none">
      <div
        className="h-full bg-indigo-500 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(99,102,241,0.7)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
