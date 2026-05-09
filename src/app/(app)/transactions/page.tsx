"use client";

import { useEffect, useState, useMemo, Suspense } from "react"; // useEffect already present
import { useActiveCompany } from "@/lib/auth/client";
import { useSearchParams } from "next/navigation";
import type { Transaction, Subcategory } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { classifySubcategory } from "@/lib/detection/subcategory-classifier";
import { normalizeMerchant, coreMerchant } from "@/lib/detection/merchant-normalizer";
import { toast } from "sonner";

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
  reasoning: string;
}

interface SuspiciousInfo {
  merchant: string;
  reason: string;
  riskLevel: string;
}

const PAGE_SIZES = [25, 50, 100];

function TransactionsPageInner() {
  const { companyId } = useActiveCompany();
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [vendorMap, setVendorMap] = useState<Map<string, VendorInfo>>(new Map());
  const [suspiciousMap, setSuspiciousMap] = useState<Map<string, SuspiciousInfo>>(new Map());
  const [filter, setFilter] = useState<Subcategory | "all" | "suspicious">(
    (searchParams.get("filter") as Subcategory | "suspicious") || "all"
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [correctingTx, setCorrectingTx] = useState<string | null>(null);
  const [correctionSubcategory, setCorrectionSubcategory] = useState<Subcategory>("one-off");
  const [savingCorrection, setSavingCorrection] = useState(false);

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

          // Build reasoning lookup from patterns
          const reasoningMap = new Map<string, string>();
          for (const pe of json.patterns?.recurringExpenses ?? []) {
            if (pe.aiReasoning) reasoningMap.set(pe.merchant?.toLowerCase(), pe.aiReasoning);
          }
          for (const pi of json.patterns?.recurringIncome ?? []) {
            if (pi.aiReasoning) reasoningMap.set(pi.merchant?.toLowerCase(), pi.aiReasoning);
          }
          for (const nv of json.newVendors ?? []) {
            if (nv.reasoning) reasoningMap.set(nv.merchantNormalized?.toLowerCase(), nv.reasoning);
          }

          for (const v of json.vendors.recurring) {
            map.set(v.canonicalName.toLowerCase(), {
              ...v,
              reasoning: reasoningMap.get(v.canonicalName.toLowerCase()) ?? v.subcategory
                ? `Classified as ${v.subcategory.replace(/-/g, " ")} based on ${v.appearanceCount} appearances across ${v.monthsSeen} months`
                : "",
            });
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
    let result = transactions;

    // Apply category filter
    if (filter === "suspicious") {
      result = result.filter((tx) => {
        const key = coreMerchant(normalizeMerchant(tx.description)).toLowerCase();
        return suspiciousMap.has(key);
      });
    } else if (filter !== "all") {
      result = result.filter((tx) => {
        const key = coreMerchant(normalizeMerchant(tx.description)).toLowerCase();
        const vendor = vendorMap.get(key);
        if (vendor) return vendor.subcategory === filter;
        const { subcategory } = classifySubcategory(tx.description);
        return subcategory === filter;
      });
    }

    // Apply text search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter((tx) => {
        const desc = tx.description.toLowerCase();
        const key = coreMerchant(normalizeMerchant(tx.description)).toLowerCase();
        const vendor = vendorMap.get(key);
        const subcat = vendor?.subcategory ?? classifySubcategory(tx.description).subcategory;
        const catLabel = subcat.replace(/-/g, " ");
        return desc.includes(q) || catLabel.includes(q) || (vendor?.canonicalName?.toLowerCase().includes(q));
      });
    }

    return result;
  }, [transactions, filter, vendorMap, suspiciousMap, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const totalPages = Math.ceil(filtered.length / pageSize);

  // Reset page when filter or search changes
  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const matchedVendor = (tx: Transaction): VendorInfo | null => {
    const key = coreMerchant(normalizeMerchant(tx.description)).toLowerCase();
    return vendorMap.get(key) ?? null;
  };

  const matchedSuspicious = (tx: Transaction): SuspiciousInfo | null => {
    const key = coreMerchant(normalizeMerchant(tx.description)).toLowerCase();
    return suspiciousMap.get(key) ?? null;
  };

  const handleCorrect = async (tx: Transaction) => {
    setSavingCorrection(true);
    try {
      const r = await fetch("/api/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionDescription: tx.description,
          originalSubcategory: tx.subcategory ?? "one-off",
          correctedSubcategory: correctionSubcategory,
          transactionDate: tx.date,
          transactionAmount: tx.amount,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast.success(`Saved: ${tx.description.slice(0, 40)} → ${correctionSubcategory.replace(/-/g, " ")}`);
      setCorrectingTx(null);
    } catch {
      toast.error("Failed to save correction");
    } finally {
      setSavingCorrection(false);
    }
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
            {search ? ` · matching "${search}"` : ""}
          </p>
        </div>
      </div>

      {/* Search + page size */}
      <div className="flex gap-3 mb-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by description, vendor, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-zinc-200 rounded-lg bg-white focus:outline-none focus:border-zinc-400 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          className="text-xs border border-zinc-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:border-zinc-400"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>{s} per page</option>
          ))}
        </select>
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

        {paginated.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-zinc-400">
            {search ? "No transactions match your search." : "No transactions match this filter."}
          </div>
        ) : (
          paginated.map((tx) => {
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
                            {vendor.reasoning && (
                              <div className="mt-2 p-2 rounded bg-blue-50 border border-blue-100">
                                <div className="text-blue-700 text-[11px] font-medium mb-0.5">AI reasoning</div>
                                <div className="text-blue-600 text-[11px] leading-relaxed">{vendor.reasoning}</div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-zinc-400">No vendor intelligence available. Upload more statements to build vendor profiles.</div>
                        )}

                        {/* Correction UI */}
                        <div className="mt-3 pt-3 border-t border-zinc-200">
                          {correctingTx === tx.id ? (
                            <div className="space-y-2">
                              <div className="text-zinc-500 font-medium text-[11px]">Correct category</div>
                              <select
                                value={correctionSubcategory}
                                onChange={(e) => setCorrectionSubcategory(e.target.value as Subcategory)}
                                className="w-full text-xs border border-zinc-300 rounded px-2 py-1 bg-white"
                              >
                                {SUBCATEGORIES.filter((s) => s.value !== "all" && s.value !== "suspicious").map((s) => (
                                  <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                              </select>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleCorrect(tx)}
                                  disabled={savingCorrection}
                                  className="px-2.5 py-1 rounded text-[11px] font-medium bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50"
                                >
                                  {savingCorrection ? "Saving..." : "Save"}
                                </button>
                                <button
                                  onClick={() => setCorrectingTx(null)}
                                  className="px-2.5 py-1 rounded text-[11px] text-zinc-500 hover:bg-zinc-200"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setCorrectingTx(tx.id);
                                setCorrectionSubcategory((vendor?.subcategory as Subcategory) ?? "one-off");
                              }}
                              className="text-[11px] text-zinc-400 hover:text-zinc-700 transition-colors"
                            >
                              Correct category →
                            </button>
                          )}
                        </div>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-xs text-zinc-400">
            Page {page} of {totalPages} ({filtered.length} results)
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              // Show pages around current page
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                    pageNum === page
                      ? "bg-zinc-900 text-white"
                      : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Quick jump when many pages */}
      {totalPages > 7 && (
        <div className="text-center mt-2">
          <span className="text-[10px] text-zinc-400">
            Go to page:
          </span>
          <select
            value={page}
            onChange={(e) => setPage(Number(e.target.value))}
            className="ml-2 text-xs border border-zinc-200 rounded px-1.5 py-0.5 bg-white"
          >
            {Array.from({ length: totalPages }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}</option>
            ))}
          </select>
        </div>
      )}
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
