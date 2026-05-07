"use client";

import type { DocumentHistoryEntry } from "@/lib/history";
import { formatCurrency } from "@/lib/utils";

interface Props {
 entry: DocumentHistoryEntry;
 onClick?: () => void;
 isLoading?: boolean;
}

export function DocumentHistoryCard({ entry, onClick, isLoading }: Props) {
 return (
 <button
 type="button"
 onClick={onClick}
 disabled={isLoading}
 className="w-full text-left bg-white border border-zinc-200 rounded-xl p-5 insight-card-hover disabled:opacity-60 disabled:cursor-wait"
 >
 <div className="flex items-start justify-between gap-4">
 <div className="min-w-0 flex-1">
 <h3 className="font-display text-sm font-semibold text-zinc-900 truncate">
 {entry.filename}
 </h3>
 <div className="flex items-center gap-3 mt-1.5 flex-wrap">
 <span className="text-xs text-zinc-400 text-zinc-500 font-mono">
 {new Date(entry.uploadedAt).toLocaleDateString("en-GB", {
 day: "numeric",
 month: "short",
 year: "numeric",
 })}
 </span>
 <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 bg-zinc-50 text-zinc-500 capitalize">
 {entry.mode}
 </span>
 </div>
 </div>

 <div className="shrink-0 text-right">
 <p className={`font-mono text-lg font-medium ${entry.netFlow >= 0 ? "text-emerald-600 text-emerald-600" : "text-red-500"}`}>
 {formatCurrency(entry.netFlow)}
 </p>
 <p className="text-[10px] text-zinc-400 text-zinc-500 font-mono uppercase tracking-wider">
 net flow
 </p>
 </div>
 </div>

 <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-200">
 <span className="text-xs text-zinc-500">
 {entry.insightCount} {entry.insightCount === 1 ? "finding" : "findings"}
 </span>
 {entry.topFinding && (
 <span className="text-xs text-zinc-400 text-zinc-500 truncate">
 Top: {entry.topFinding}
 </span>
 )}
 <span
 className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium ${
 entry.cashFlowHealth === "excellent"
 ? "bg-emerald-100 text-emerald-700 bg-emerald-50 text-emerald-600"
 : entry.cashFlowHealth === "good"
 ? "bg-zinc-100 text-zinc-800 bg-zinc-50 text-zinc-700"
 : entry.cashFlowHealth === "fair"
 ? "bg-orange-100 text-orange-700"
 : "bg-red-100 text-red-700"
 }`}
 >
 {entry.cashFlowHealth}
 </span>
 </div>
 </button>
 );
}
