"use client";

import { useRouter, usePathname } from "next/navigation";

export function FloatingBack() {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === "/dashboard") return null;

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Go back"
      className="fixed top-4 left-4 z-50 w-9 h-9 md:w-10 md:h-10 rounded-full glass flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 group"
    >
      <svg
        className="w-4 h-4 text-warm-black/50 dark:text-warm-white/50 group-hover:text-warm-black dark:group-hover:text-warm-white transition-colors"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
      </svg>
    </button>
  );
}
