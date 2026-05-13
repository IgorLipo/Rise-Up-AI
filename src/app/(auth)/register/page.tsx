"use client";

import { createClient } from "@/lib/supabase";
import { useState } from "react";
import { toast } from "sonner";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { toast.error(error.message); setLoading(false); return; }
    if (!data.user) { toast.error("Registration failed"); setLoading(false); return; }

    // Create company
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({ name: companyName, owner_id: data.user.id })
      .select("id")
      .single();

    if (companyError || !company) {
      toast.error("Failed to create company");
      setLoading(false);
      return;
    }

    // Add as member
    await supabase.from("company_members").insert({
      company_id: company.id,
      user_id: data.user.id,
      role: "owner",
    });

    window.location.href = "/dashboard";
    setLoading(false);
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Cashflow</h1>
        <p className="text-sm text-zinc-500 mt-1">Create your account</p>
      </div>
      <div className="bg-white border border-zinc-200 rounded-xl p-6">
        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Company name"
            required
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 characters)"
            required
            minLength={8}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            Create account
          </button>
        </form>
        <div className="text-center mt-4 text-xs text-zinc-500">
          Already have an account? <a href="/login" className="text-zinc-900 font-medium underline">Sign in</a>
        </div>
      </div>
    </div>
  );
}
