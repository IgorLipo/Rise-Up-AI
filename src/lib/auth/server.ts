import { createServerSupabase } from "@/lib/supabase/server";
import { cache } from "react";

export const getUser = cache(async () => {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

export async function getActiveCompanyId(): Promise<string | null> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  return data?.company_id ?? null;
}

export async function getActiveCompany() {
  const supabase = await createServerSupabase();
  const companyId = await getActiveCompanyId();
  if (!companyId) return null;

  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  return data;
}

export async function getUserCompanies() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("company_members")
    .select("company_id, companies(*)")
    .eq("user_id", user.id);

  return data?.map((d: any) => d.companies) ?? [];
}
