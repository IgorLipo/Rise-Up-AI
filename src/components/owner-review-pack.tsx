"use client";

import type { OwnerReviewItem } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface OwnerReviewPackProps {
  items: OwnerReviewItem[];
  onItemClick?: (insightId: string) => void;
}

export function OwnerReviewPack({ items, onItemClick }: OwnerReviewPackProps) {
  if (items.length === 0) return null;

  return (
    <div className="glass rounded-xl border-l-4 border-amber-500">
      <div className="p-5 border-b border-warm-gray dark:border-warm-white/5">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
          </svg>
          <h3 className="font-display text-base font-semibold text-warm-black dark:text-warm-white">
            Owner Review Pack
          </h3>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            {items.length} items
          </span>
        </div>
        <p className="text-xs text-warm-black/40 dark:text-warm-white/30 mt-1.5">
          Prioritised list of items to check. Each item is linked to a specific finding and includes the amount, reason, and a question to ask.
        </p>
      </div>

      <div className="divide-y divide-warm-gray dark:divide-warm-white/5">
        {items.map((item) => (
          <button
            key={`${item.related_insight_id}-${item.priority}`}
            type="button"
            onClick={() => onItemClick?.(item.related_insight_id)}
            className="w-full text-left p-4 hover:bg-warm-gray/20 dark:hover:bg-white/[0.02] transition-colors group"
          >
            <div className="flex items-start gap-4">
              {/* Priority number */}
              <span className="font-display text-2xl font-bold text-amber-300 dark:text-amber-700 shrink-0 leading-none mt-0.5">
                {item.priority}
              </span>

              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-medium text-warm-black dark:text-warm-white leading-snug group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors">
                  {item.item}
                </h4>

                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="font-mono text-sm font-medium text-red-500">
                    {formatCurrency(item.amount)}
                  </span>
                  <span className="text-xs text-warm-black/40 dark:text-warm-white/30">
                    {item.reason}
                  </span>
                </div>

                <div className="mt-2 flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-warm-black/50 dark:text-warm-white/40 italic leading-relaxed">
                    &ldquo;{item.suggested_question}&rdquo;
                  </p>
                </div>
              </div>

              {/* Arrow indicator */}
              <svg className="w-4 h-4 text-warm-black/20 dark:text-warm-white/15 shrink-0 mt-1 group-hover:text-amber-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
