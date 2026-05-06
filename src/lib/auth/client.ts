"use client";

import { createClient } from "@/lib/supabase";
import { useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";

let cachedUser: User | null = null;
let cachedCompanyId: string | null = null;

export function useUser() {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      cachedUser = user;
      setUser(user);
      setLoading(false);
    });
  }, []);

  return { user, loading };
}

export function useActiveCompany() {
  const [companyId, setCompanyId] = useState<string | null>(cachedCompanyId);
  const { user } = useUser();

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1)
      .single()
      .then(({ data }) => {
        const id = data?.company_id ?? null;
        cachedCompanyId = id;
        setCompanyId(id);
      });
  }, [user]);

  const switchCompany = useCallback((id: string) => {
    cachedCompanyId = id;
    setCompanyId(id);
  }, []);

  return { companyId, switchCompany };
}
