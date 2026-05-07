"use client";

interface Props {
  headline: string;
  summary: string;
  onViewTransactions?: () => void;
  onDismiss?: () => void;
  severity?: "info" | "warning" | "critical";
}

const severityColors = {
  info: { border: "border-l-zinc-900", text: "text-zinc-900", bg: "bg-zinc-50", label: "what you need to know" },
  warning: { border: "border-l-amber-500", text: "text-amber-700", bg: "bg-amber-50", label: "needs attention" },
  critical: { border: "border-l-red-500", text: "text-red-700", bg: "bg-red-50", label: "urgent" },
};

export function InsightHeroCard({ headline, summary, onViewTransactions, onDismiss, severity = "info" }: Props) {
  const colors = severityColors[severity];
  return (
    <div className={`bg-white border border-zinc-200 rounded-xl p-4 border-l-3 ${colors.border}`}>
      <div className={`text-[10px] ${colors.text} uppercase tracking-wider font-medium mb-2`}>
        {colors.label}
      </div>
      <div className="text-sm font-semibold text-zinc-900 leading-snug mb-1">{headline}</div>
      <div className="text-xs text-zinc-500 leading-relaxed mb-3">{summary}</div>
      {(onViewTransactions || onDismiss) && (
        <div className="flex gap-2">
          {onViewTransactions && (
            <button
              onClick={onViewTransactions}
              className="px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-medium hover:bg-zinc-800 transition-colors"
            >
              View transactions
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 border border-zinc-200 rounded-lg text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}
