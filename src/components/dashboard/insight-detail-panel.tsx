"use client";

import { formatCurrency } from "@/lib/utils";

export interface InsightDetail {
  title: string;
  type: string;
  detail: string;
  vendor?: string;
  previousAmount?: number;
  currentAmount?: number;
  relatedTransactions?: Array<{
    date: string;
    description: string;
    amount: number;
    merchant: string;
  }>;
  historicalPattern?: string;
  forecastLogic?: string;
  confidenceScore?: number;
}

interface InsightDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  insight: InsightDetail | null;
}

export function InsightDetailPanel({ isOpen, onClose, insight }: InsightDetailPanelProps) {
  if (!isOpen || !insight) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={onClose}
      />
      {/* Slide-out panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white border-l border-zinc-200 shadow-2xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-zinc-100 px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900 truncate">{insight.title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 transition-colors">
            <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Detail text */}
          <div>
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium mb-1">Detail</div>
            <p className="text-sm text-zinc-700 leading-relaxed">{insight.detail}</p>
          </div>

          {/* Amount change */}
          {insight.previousAmount !== undefined && insight.currentAmount !== undefined && (
            <div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium mb-1">Amount change</div>
              <div className="flex items-center gap-3 text-sm">
                <span className="font-mono text-zinc-500">{formatCurrency(insight.previousAmount)}</span>
                <svg className="w-4 h-4 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <span className="font-mono font-medium text-zinc-900">{formatCurrency(insight.currentAmount)}</span>
              </div>
            </div>
          )}

          {/* Historical pattern */}
          {insight.historicalPattern && (
            <div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium mb-1">Historical pattern</div>
              <p className="text-xs text-zinc-600 leading-relaxed">{insight.historicalPattern}</p>
            </div>
          )}

          {/* Forecast logic */}
          {insight.forecastLogic && (
            <div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium mb-1">Forecast logic</div>
              <p className="text-xs text-zinc-600 leading-relaxed">{insight.forecastLogic}</p>
            </div>
          )}

          {/* Confidence score */}
          {insight.confidenceScore !== undefined && (
            <div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium mb-1">Confidence</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-800 rounded-full transition-all"
                    style={{ width: `${Math.round(insight.confidenceScore * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-zinc-500">{Math.round(insight.confidenceScore * 100)}%</span>
              </div>
            </div>
          )}

          {/* Related transactions */}
          {insight.relatedTransactions && insight.relatedTransactions.length > 0 && (
            <div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium mb-2">Related transactions</div>
              <div className="space-y-1.5">
                {insight.relatedTransactions.map((tx, i) => (
                  <div key={i} className="flex items-center justify-between bg-zinc-50 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-xs text-zinc-700 truncate capitalize">{tx.merchant || tx.description}</div>
                      <div className="text-[10px] text-zinc-400">{tx.date}</div>
                    </div>
                    <span className={`text-xs font-mono ml-2 ${tx.amount >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {tx.amount >= 0 ? "+" : ""}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
