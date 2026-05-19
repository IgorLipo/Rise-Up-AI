"use client";

import { useEffect, useState } from "react";
import { useActiveCompany } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

interface StatementDoc {
  period: string;
  month: string;
  closingBalance: number;
  transactionCount: number;
  totalIncome: number;
  totalExpenses: number;
  netFlow: number;
}

interface MonthlyGroup {
  month: string;
  label: string;
  statements: StatementDoc[];
  totalIncome: number;
  totalExpenses: number;
  netFlow: number;
  transactionCount: number;
}

function Skeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white border border-zinc-200 rounded-xl p-5">
          <div className="h-4 bg-zinc-100 rounded w-32 mb-3" />
          <div className="h-3 bg-zinc-100 rounded w-full mb-2" />
        </div>
      ))}
    </div>
  );
}

export default function HistoryPage() {
  const { companyId } = useActiveCompany();
  const router = useRouter();
  const [monthly, setMonthly] = useState<MonthlyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;

    fetch("/api/documents/aggregate")
      .then((r) => r.json())
      .then((json) => {
        if (json.documents && json.documents.length > 0) {
          const byMonth = new Map<string, StatementDoc[]>();
          for (const doc of json.documents as StatementDoc[]) {
            const month = doc.month || "unknown";
            if (!byMonth.has(month)) byMonth.set(month, []);
            byMonth.get(month)!.push(doc);
          }

          const groups: MonthlyGroup[] = [];
          for (const [month, statements] of byMonth) {
            const label = new Date(month + "-01").toLocaleDateString("en-GB", {
              year: "numeric",
              month: "long",
            });
            groups.push({
              month,
              label,
              statements,
              totalIncome: statements.reduce((s, e) => s + e.totalIncome, 0),
              totalExpenses: statements.reduce((s, e) => s + e.totalExpenses, 0),
              netFlow: statements.reduce((s, e) => s + e.netFlow, 0),
              transactionCount: statements.reduce((s, e) => s + e.transactionCount, 0),
            });
          }
          groups.sort((a, b) => b.month.localeCompare(a.month));
          setMonthly(groups);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [companyId]);

  if (loading) return <Skeleton />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Statement history</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {monthly.length} months · {monthly.reduce((s, m) => s + m.transactionCount, 0)} transactions total
          </p>
        </div>
        <button
          onClick={() => router.push("/upload")}
          className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors"
        >
          Upload more
        </button>
      </div>

      {/* Aggregate roll-ups: last 3 / last 6 / all-time. */}
      {monthly.length > 0 && (() => {
        // monthly is sorted newest-first; "last N" = first N entries.
        const slices: Array<{ label: string; rows: MonthlyGroup[] }> = [
          { label: "Last 3 months", rows: monthly.slice(0, 3) },
          { label: "Last 6 months", rows: monthly.slice(0, 6) },
          { label: `All ${monthly.length} months`, rows: monthly },
        ];
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {slices.map((s) => {
              const inc = s.rows.reduce((acc, m) => acc + m.totalIncome, 0);
              const exp = s.rows.reduce((acc, m) => acc + m.totalExpenses, 0);
              const net = inc - exp;
              const n = s.rows.length;
              return (
                <div key={s.label} className="bg-white border border-zinc-200 rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">{s.label}</div>
                  <div className={`text-xl font-bold tabular-nums mt-1 ${net >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {net >= 0 ? "+" : ""}{formatCurrency(net)}
                  </div>
                  <div className="mt-2 space-y-0.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Income</span>
                      <span className="font-mono text-emerald-700">+{formatCurrency(inc)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Expenses</span>
                      <span className="font-mono text-red-600">-{formatCurrency(exp)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Avg/month</span>
                      <span className="font-mono">{n > 0 ? formatCurrency(net / n) : "—"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {monthly.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-zinc-500 mb-4">No statements uploaded yet.</p>
          <button
            onClick={() => router.push("/upload")}
            className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            Upload your first statement
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {monthly.map((m) => {
            const isExpanded = expandedMonth === m.month;
            return (
              <div key={m.month} className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedMonth(isExpanded ? null : m.month)}
                  className="w-full p-4 text-left hover:bg-zinc-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">{m.label}</div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {m.statements.length} statement{m.statements.length > 1 ? "s" : ""} · {m.transactionCount} transactions
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={`text-sm font-mono font-medium ${
                          m.netFlow >= 0 ? "text-emerald-600" : "text-red-500"
                        }`}>
                          {m.netFlow >= 0 ? "+" : ""}{formatCurrency(m.netFlow)}
                        </div>
                        <div className="text-xs text-zinc-400">
                          in {formatCurrency(m.totalIncome)} / out {formatCurrency(m.totalExpenses)}
                        </div>
                      </div>
                      <svg
                        className={`w-4 h-4 text-zinc-300 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-zinc-100 px-4 pb-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 mb-3">
                      <div className="bg-zinc-50 rounded-lg p-2.5">
                        <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Income</div>
                        <div className="text-sm font-mono font-medium text-emerald-600 mt-0.5">
                          {formatCurrency(m.totalIncome)}
                        </div>
                      </div>
                      <div className="bg-zinc-50 rounded-lg p-2.5">
                        <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Expenses</div>
                        <div className="text-sm font-mono font-medium text-red-500 mt-0.5">
                          {formatCurrency(m.totalExpenses)}
                        </div>
                      </div>
                      <div className="bg-zinc-50 rounded-lg p-2.5">
                        <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Net flow</div>
                        <div className={`text-sm font-mono font-medium mt-0.5 ${
                          m.netFlow >= 0 ? "text-emerald-600" : "text-red-500"
                        }`}>
                          {m.netFlow >= 0 ? "+" : ""}{formatCurrency(m.netFlow)}
                        </div>
                      </div>
                      <div className="bg-zinc-50 rounded-lg p-2.5">
                        <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Statements</div>
                        <div className="text-sm font-mono font-medium text-zinc-900 mt-0.5">
                          {m.statements.length}
                        </div>
                      </div>
                    </div>

                    {m.statements.map((stmt, i) => (
                      <div key={i} className="border border-zinc-100 rounded-lg p-3 mb-2 last:mb-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-medium text-zinc-700">{stmt.period}</div>
                            <div className="text-xs text-zinc-400 mt-0.5">
                              {stmt.transactionCount} transactions
                              {stmt.closingBalance != null ? ` · closing ${formatCurrency(stmt.closingBalance)}` : ""}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/transactions?month=${m.month}`);
                            }}
                            className="px-3 py-1 rounded text-[10px] font-medium border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors"
                          >
                            View transactions
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
