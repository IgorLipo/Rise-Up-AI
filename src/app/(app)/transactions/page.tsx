"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useActiveCompany } from "@/lib/auth/client";
import { useSearchParams } from "next/navigation";
import type { Transaction, Subcategory } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { classifySubcategory } from "@/lib/detection/subcategory-classifier";

const SUBCATEGORIES: Array<{ value: Subcategory | "all" | "suspicious"; label: string }> = [
  { value: "all", label: "All" },
  { value: "car-expenses", label: "Car" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "software", label: "Software" },
  { value: "rent", label: "Rent" },
  { value: "taxes", label: "Taxes" },
  { value: "loans", label: "Loans" },
  { value: "utilities", label: "Utilities" },
  { value: "salary", label: "Salaries" },
  { value: "insurance", label: "Insurance" },
  { value: "supplier-payments", label: "Suppliers" },
  { value: "supplies", label: "Supplies" },
  { value: "bank-fees", label: "Bank fees" },
  { value: "director-loans", label: "Director loans" },
  { value: "property-management", label: "Property" },
  { value: "professional-services", label: "Services" },
  { value: "one-off", label: "One-off" },
  { value: "suspicious", label: "Flagged" },
];

interface VendorInfo {
  canonicalName: string;
  subcategory: string;
  recurrencePattern: string | null;
  appearanceCount: number;
  monthsSeen: number;
  typicalAmount: number;
  confidence: number;
}

interface SuspiciousInfo {
  merchant: string;
  reason: string;
  riskLevel: string;
}

function TransactionsPageInner() {
  const { companyId } = useActiveCompany();
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [vendorMap, setVendorMap] = useState<Map<string, VendorInfo>>(new Map());
  const [suspiciousMap, setSuspiciousMap] = useState<Map<string, SuspiciousInfo>>(new Map());
  const [filter, setFilter] = useState<Subcategory | "all" | "suspicious">(
    (searchParams.get("filter") as Subcategory | "suspicious") || "all"
  );
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!companyId) return;

    fetch("/api/documents/aggregate")
      .then((r) => r.json())
      .then((json) => {
        // Load transactions from all documents
        fetch("/api/documents")
          .then((r) => r.json())
          .then((listJson) => {
            const docs = listJson.documents ?? [];
            Promise.all(
              docs.slice(0, 10).map((d: { id: string }) =>
                fetch(`/api/documents/${d.id}`).then((r) => r.json())
              )
            ).then((results) => {
              const allTx: Transaction[] = results.flatMap(
                (res: { document?: { statement_data?: { transactions?: Transaction[] } } }) =>
                  res.document?.statement_data?.transactions ?? []
              );
              // Deduplicate by id
              const seen = new Set<string>();
              const unique = allTx.filter((tx) => {
                if (seen.has(tx.id)) return false;
                seen.add(tx.id);
                return true;
              });
              setTransactions(unique);
              setLoading(false);
            }).catch(() => setLoading(false));
          }).catch(() => setLoading(false));

        // Build vendor map from the aggregate response
        if (json.vendors?.recurring) {
          const map = new Map<string, VendorInfo>();
          for (const v of json.vendors.recurring) {
            map.set(v.canonicalName.toLowerCase(), v);
          }
          setVendorMap(map);
        }

        // Build suspicious map
        if (json.suspicious) {
          const map = new Map<string, SuspiciousInfo>();
          for (const s of json.suspicious) {
            map.set(s.merchant.toLowerCase(), s);
          }
          setSuspiciousMap(map);
        }
      })
      .catch(() => setLoading(false));
  }, [companyId]);

  const filtered = useMemo(() => {
    if (filter === "suspicious") {
      return transactions.filter((tx) => {
        const core = tx.description.toLowerCase().split(/[\s,]+/).slice(0, 2).join(" ");
        return suspiciousMap.has(core);
      });
    }
    if (filter === "all") return transactions;
    return transactions.filter((tx) => {
      const core = tx.description.toLowerCase().split(/[\s,]+/).slice(0, 2).join(" ");
      const vendor = vendorMap.get(core);
      if (vendor) return vendor.subcategory === filter;
      const { subcategory } = classifySubcategory(tx.description);
      return subcategory === filter;
    });
  }, [transactions, filter, vendorMap, suspiciousMap]);

  const matchedVendor = (tx: Transaction): VendorInfo | null => {
    const core = tx.description.toLowerCase().split(/[\s,]+/).slice(0, 2).join(" ");
    return vendorMap.get(core) ?? null;
  };

  const matchedSuspicious = (tx: Transaction): SuspiciousInfo | null => {
    const core = tx.description.toLowerCase().split(/[\s,]+/).slice(0, 2).join(" ");
    return suspiciousMap.get(core) ?? null;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-3">
        <div className="h-7 bg-zinc-100 rounded w-32 animate-pulse" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-6 bg-zinc-100 rounded-full w-16 animate-pulse" />
          ))}
        </div>
        <div className="space-y-2 mt-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-10 bg-zinc-50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Transactions</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {filtered.length} of {transactions.length} transactions
            {vendorMap.size > 0 ? ` · ${vendorMap.size} vendors known` : ""}
          </p>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {SUBCATEGORIES.map((s) => (
          <button
            key={s.value}
            onClick={() => setFilter(s.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filter === s.value
                ? "bg-zinc-900 text-white"
                : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Transaction list */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_100px_90px] gap-3 px-4 py-2.5 text-[10px] text-zinc-400 uppercase tracking-wider font-medium border-b border-zinc-100">
          <div>Description / Vendor intel</div>
          <div>Date</div>
          <div className="text-right">Amount</div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-zinc-400">
            No transactions match this filter.
          </div>
        ) : (
          filtered.slice(0, 300).map((tx) => {
            const vendor = matchedVendor(tx);
            const suspicious = matchedSuspicious(tx);
            const isSelected = selectedTx?.id === tx.id;

            return (
              <div key={tx.id}>
                <button
                  onClick={() => setSelectedTx(isSelected ? null : tx)}
                  className={`w-full grid grid-cols-[1fr_100px_90px] gap-3 px-4 py-2.5 text-xs border-b border-zinc-50 hover:bg-zinc-50 transition-colors text-left ${
                    isSelected ? "bg-zinc-50" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-zinc-700 truncate">{tx.description}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {vendor && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500">
                          {vendor.subcategory.replace(/-/g, " ")}
                          {vendor.recurrencePattern ? ` · ${vendor.recurrencePattern}` : ""}
                          {vendor.appearanceCount > 1 ? ` · ${vendor.appearanceCount}x` : ""}
                        </span>
                      )}
                      {suspicious && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          suspicious.riskLevel === "high" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {suspicious.riskLevel}
                        </span>
                      )}
                      {!vendor && !suspicious && (
                        <span className="text-[10px] text-zinc-300">unknown</span>
                      )}
                    </div>
                  </div>
                  <div className="text-zinc-400 tabular-nums self-center">{tx.date}</div>
                  <div
                    className={`font-mono tabular-nums font-medium text-right self-center ${
                      tx.type === "credit" ? "text-emerald-600" : "text-red-500"
                    }`}
                  >
                    {tx.type === "credit" ? "+" : "-"}
                    {formatCurrency(tx.amount)}
                  </div>
                </button>

                {/* Expandable explainability panel */}
                {isSelected && (
                  <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                    <div className="grid sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-zinc-400 font-medium mb-1">Classification</div>
                        {vendor ? (
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Category</span>
                              <span className="text-zinc-700 font-medium">
                                {vendor.subcategory.replace(/-/g, " ")}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Pattern</span>
                              <span className="text-zinc-700">
                                {vendor.recurrencePattern ?? "irregular"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Confidence</span>
                              <span className="text-zinc-700">
                                {Math.round(vendor.confidence * 100)}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Appearances</span>
                              <span className="text-zinc-700">
                                {vendor.appearanceCount}x across {vendor.monthsSeen} months
                              </span>
                            </div>
                            {vendor.typicalAmount > 0 && (
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Typical amount</span>
                                <span className="text-zinc-700">{formatCurrency(vendor.typicalAmount)}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-zinc-400">No vendor intelligence available. Upload more statements to build vendor profiles.</div>
                        )}
                      </div>

                      <div>
                        <div className="text-zinc-400 font-medium mb-1">Transaction details</div>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Type</span>
                            <span className="text-zinc-700">{tx.type}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Direction</span>
                            <span className="text-zinc-700">{tx.direction ?? (tx.type === "credit" ? "income" : "expense")}</span>
                          </div>
                          {tx.reference && (
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Reference</span>
                              <span className="text-zinc-700 truncate max-w-[150px]">{tx.reference}</span>
                            </div>
                          )}
                          {tx.payment_method && (
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Method</span>
                              <span className="text-zinc-700">{tx.payment_method}</span>
                            </div>
                          )}
                        </div>

                        {suspicious && (
                          <div className="mt-3 p-2 rounded bg-red-50 border border-red-100">
                            <div className="text-red-700 font-medium text-xs mb-0.5">Flagged — {suspicious.riskLevel} risk</div>
                            <div className="text-red-600 text-xs">{suspicious.reason}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">Loading transactions...</div>}>
      <TransactionsPageInner />
    </Suspense>
  );
}
