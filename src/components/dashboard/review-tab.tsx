"use client";

import { SuspiciousFlagged } from "@/components/dashboard/suspicious-flagged";
import { formatCurrency } from "@/lib/utils";

interface ReviewTabProps {
  suspicious: Array<{
    merchant: string;
    reason: string;
    riskLevel: "low" | "medium" | "high";
    suggestedCategory: string;
    shouldExcludeFromBusiness: boolean;
    date: string;
    amount: number;
    description: string;
  }>;
}

export function ReviewTab({ suspicious }: ReviewTabProps) {
  return (
    <div>
      {/* Stats summary bar */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border border-zinc-200 rounded-lg p-3 text-center">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">Total flagged</div>
          <div className="text-lg font-bold text-zinc-900 tabular-nums mt-0.5">{suspicious.length}</div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg p-3 text-center">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">High risk</div>
          <div className="text-lg font-bold text-red-600 tabular-nums mt-0.5">{suspicious.filter(s => s.riskLevel === "high").length}</div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg p-3 text-center">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">Total amount</div>
          <div className="text-lg font-bold text-zinc-900 tabular-nums mt-0.5">{formatCurrency(suspicious.reduce((sum, s) => sum + s.amount, 0))}</div>
        </div>
      </div>

      {/* Instructional text */}
      <div className="mb-3">
        <p className="text-xs text-zinc-500">
          Review each flagged transaction below. Your decisions help improve future categorization and forecast accuracy.
        </p>
      </div>

      {/* Flagged items with actions */}
      <SuspiciousFlagged
        flagged={suspicious}
        onAction={(item, action) => {
          console.log("Review action:", { item: item.merchant || item.description, action });
          // TODO: POST to /api/review/decisions when endpoint exists
        }}
      />
    </div>
  );
}
