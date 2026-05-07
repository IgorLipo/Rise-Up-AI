"use client";

import { useEffect, useState, useMemo } from "react";
import { useActiveCompany } from "@/lib/auth/client";
import type { StatementData, Transaction, Subcategory } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { classifySubcategory } from "@/lib/detection/subcategory-classifier";

export default function TransactionsPage() {
  const { companyId } = useActiveCompany();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<Subcategory | "all">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    fetch("/api/documents")
      .then((r) => r.json())
      .then((json) => {
        const docs = json.documents ?? [];
        Promise.all(
          docs.slice(0, 5).map((d: { id: string }) =>
            fetch(`/api/documents/${d.id}`).then((r) => r.json())
          )
        ).then((results) => {
          const allTx: Transaction[] = results.flatMap(
            (res: { document?: { statement_data?: StatementData } }) =>
              res.document?.statement_data?.transactions ?? []
          );
          setTransactions(allTx);
          setLoading(false);
        });
      })
      .catch(() => setLoading(false));
  }, [companyId]);

  const filtered = useMemo(() => {
    if (filter === "all") return transactions;
    return transactions.filter((tx) => {
      const { subcategory } = classifySubcategory(tx.description);
      return subcategory === filter;
    });
  }, [transactions, filter]);

  const subcategories: Array<{ value: Subcategory | "all"; label: string }> = [
    { value: "all", label: "All" },
    { value: "subscriptions", label: "Subscriptions" },
    { value: "software", label: "Software" },
    { value: "car-expenses", label: "Car" },
    { value: "rent", label: "Rent" },
    { value: "taxes", label: "Taxes" },
    { value: "loans", label: "Loans" },
    { value: "utilities", label: "Utilities" },
    { value: "salary", label: "Salaries" },
    { value: "insurance", label: "Insurance" },
    { value: "supplier-payments", label: "Suppliers" },
    { value: "one-off", label: "One-off" },
  ];

  if (loading) return <div className="p-6 text-sm text-zinc-500">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-lg font-bold text-zinc-900 mb-4">Transactions</h1>
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {subcategories.map((s) => (
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
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2 text-[10px] text-zinc-400 uppercase tracking-wider font-medium border-b border-zinc-100">
          <div>Description</div>
          <div>Date</div>
          <div>Amount</div>
        </div>
        {filtered.slice(0, 200).map((tx) => (
          <div
            key={tx.id}
            className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2.5 text-xs border-b border-zinc-50 hover:bg-zinc-50 transition-colors"
          >
            <div className="text-zinc-700 truncate">{tx.description}</div>
            <div className="text-zinc-400 tabular-nums">{tx.date}</div>
            <div
              className={`font-mono tabular-nums font-medium ${
                tx.type === "credit" ? "text-green-600" : "text-red-600"
              }`}
            >
              {tx.type === "credit" ? "+" : "-"}
              {formatCurrency(tx.amount)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
