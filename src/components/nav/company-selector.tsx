"use client";

import { useActiveCompany } from "@/lib/auth/client";
import { createClient } from "@/lib/supabase";
import { useEffect, useState } from "react";

interface Company {
  id: string;
  name: string;
}

export function CompanySelector() {
  const { companyId, switchCompany } = useActiveCompany();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("company_members")
        .select("company_id, companies(id, name)")
        .eq("user_id", user.id)
        .then(({ data }) => {
          if (data) setCompanies(data.map((d: any) => d.companies));
        });
    });
  }, []);

  const current = companies.find((c) => c.id === companyId);

  if (companies.length <= 1) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 rounded-lg text-xs font-medium text-zinc-700 hover:bg-zinc-200 transition-colors"
      >
        {current?.name ?? "Select company"}
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 right-0 z-50 bg-white border border-zinc-200 rounded-lg shadow-lg py-1 min-w-[180px]">
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => { switchCompany(c.id); setOpen(false); window.location.reload(); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 transition-colors ${
                  c.id === companyId ? "font-medium text-zinc-900" : "text-zinc-600"
                }`}
              >
                {c.name}
                {c.id === companyId && <span className="ml-2 text-green-600 text-xs">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
