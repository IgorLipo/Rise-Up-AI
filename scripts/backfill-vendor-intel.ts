#!/usr/bin/env node
/**
 * Backfill script: populates vendor_intel for all existing statement_history data.
 *
 * Usage: npx tsx scripts/backfill-vendor-intel.ts [--company-id <uuid>]
 *
 * Requires:
 *   SUPABASE_SERVICE_ROLE_KEY in env (never commit this key)
 *   NEXT_PUBLIC_SUPABASE_URL in env
 *
 * Reads all statement_history rows, extracts transactions from each associated
 * document, runs learnFromHistory across all transactions, and calls
 * ensureCompleteVendorIntel to research unknown vendors and upsert all entries.
 */

import { createClient } from "@supabase/supabase-js";
import { learnFromHistory } from "../src/lib/learning/cross-month-learner";
import { ensureCompleteVendorIntel } from "../src/lib/vendor-intel";
import type { Transaction, StatementData } from "../src/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const args = process.argv.slice(2);
const companyIdFlag = args.indexOf("--company-id");
const filterCompanyId = companyIdFlag !== -1 ? args[companyIdFlag + 1] : null;

async function main() {
  console.log("Starting vendor_intel backfill...");
  if (filterCompanyId) {
    console.log(`Scoped to company: ${filterCompanyId}`);
  }

  // 1. Query statement_history
  let query = supabase.from("statement_history").select("id, company_id, document_id, filename");
  if (filterCompanyId) {
    query = query.eq("company_id", filterCompanyId);
  }
  const { data: historyRows, error: historyError } = await query.order("uploaded_at", { ascending: true });

  if (historyError) {
    console.error("Failed to query statement_history:", historyError);
    process.exit(1);
  }

  if (!historyRows || historyRows.length === 0) {
    console.log("No statement_history rows found.");
    process.exit(0);
  }

  console.log(`Found ${historyRows.length} statement_history rows`);

  // 2. Group by company_id
  const companyMap = new Map<string, { companyId: string; rows: typeof historyRows }>();
  for (const row of historyRows) {
    if (!companyMap.has(row.company_id)) {
      companyMap.set(row.company_id, {
        companyId: row.company_id,
        rows: [],
      });
    }
    companyMap.get(row.company_id)!.rows.push(row);
  }

  console.log(`Processing ${companyMap.size} companies...`);

  // 3. For each company, load all transactions and run the pipeline
  for (const [companyId, { rows }] of companyMap) {
    process.stdout.write(`\nCompany ${companyId} (${rows.length} statements): `);

    const allTransactions: Transaction[] = [];

    for (const row of rows) {
      if (!row.document_id) {
        process.stdout.write(`[skip ${row.filename}: no doc] `);
        continue;
      }

      // Fetch the associated document to get statement_data
      const { data: docRow, error: docError } = await supabase
        .from("documents")
        .select("statement_data")
        .eq("id", row.document_id)
        .single();

      if (docError || !docRow?.statement_data) {
        process.stdout.write(`[warn ${row.filename}: no data] `);
        continue;
      }

      const stmt = docRow.statement_data as unknown as StatementData;
      if (stmt?.transactions) {
        allTransactions.push(...stmt.transactions);
      }
    }

    if (allTransactions.length === 0) {
      process.stdout.write("no transactions found.");
      continue;
    }

    process.stdout.write(`${allTransactions.length} txs → `);

    // 4. Learn from all transactions
    const learningReport = learnFromHistory(allTransactions);

    process.stdout.write(`${learningReport.totalVendors} vendors... `);

    // 5. Ensure complete vendor intel (research + persist)
    try {
      const entries = await ensureCompleteVendorIntel(learningReport, companyId);
      process.stdout.write(`upserted ${entries.length} vendor entries. DONE`);
    } catch (err: any) {
      process.stdout.write(`ERROR: ${err.message}`);
    }
  }

  console.log("\n\nBackfill complete.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
