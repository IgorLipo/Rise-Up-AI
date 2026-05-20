import type { RecurringPayment, ConfidenceTier } from "@/lib/detection/pattern-detector";
import type { EnrichedDetectedPatterns } from "@/lib/detection";
import type { VendorMonthlyHistory } from "./hybrid-forecaster";

export type ForecastItemStatus = "completed" | "expected" | "late" | "uncertain";

export interface ExpectedTransaction {
  merchant: string;
  expectedAmount: number;
  category: string;
  subcategory: string;
  recurring: boolean;
  confidence: number;
  confidenceTier: ConfidenceTier;
  status: ForecastItemStatus;
  recurrence: RecurringPayment | null;
}

export interface DailyForecast {
  date: string;
  openingBalance: number;
  expectedIncome: number;
  expectedExpenses: number;
  mediumConfidenceIncome: number;
  mediumConfidenceExpenses: number;
  closingBalance: number;
  transactions: ExpectedTransaction[];
  possibleUpcoming: ExpectedTransaction[];  // MEDIUM confidence
  riskFlag: boolean;
  riskMessage?: string;
  transactionCount: number;  // total count for this day (for "+X more" display)
}

function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getMonthStart(date: Date): Date {
  // Use UTC consistently — getDate()/getMonth() are local-tz, which causes
  // the iteration boundary to slip into the previous month near midnight UTC
  // (Thu 30 Apr appearing in May's daily forecast was this bug).
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export interface DailyForecastOptions {
  /**
   * Optional list of actual transactions (any direction) that happened in
   * the current calendar month. When provided, past days of the month show
   * the real transactions (with status="completed") instead of projected
   * estimates. Allows the UI to render the full-month view: actuals + projected.
   */
  actualThisMonth?: Array<{
    date: string;
    description: string;
    amount: number;        // always positive
    type: "credit" | "debit";
    subcategory?: string;
  }>;
  /**
   * Balance at the START of the current calendar month. If omitted, we work
   * backwards from `currentBalance` by subtracting actuals up to today.
   */
  monthStartBalance?: number;

  /**
   * Per-vendor monthly-total history (same data the hybrid forecaster uses).
   * Each recurring vendor gets ONE projection in the current month placed on
   * its mode day-of-month, with amount = avg of monthlyTotals across
   * `recentCompleteMonths`. This guarantees the chart sums to the same
   * full-monthly recurring totals the hybrid headline shows — no scaling.
   */
  vendorHistory?: VendorMonthlyHistory[];

  /**
   * Recent complete-month keys (YYYY-MM) used by the hybrid forecaster's
   * "fired in ≥2 of last 3" rule. Typically the last 3 complete months.
   */
  recentCompleteMonths?: string[];
}

export function generateDailyForecast(
  patterns: EnrichedDetectedPatterns,
  currentBalance: number,
  today: string = formatDate(new Date()),
  options: DailyForecastOptions = {}
): DailyForecast[] {
  // Anchor on UTC so the loop boundaries are stable across timezones.
  const todayDate = new Date(today + "T00:00:00Z");
  const monthStart = getMonthStart(todayDate);
  const monthEnd = getMonthEnd(todayDate);
  const monthEndStr = formatDate(monthEnd);
  const monthStartStr = formatDate(monthStart);
  const days: DailyForecast[] = [];

  // Build maps of expected transactions per day, separated by tier
  const perDay = new Map<string, ExpectedTransaction[]>();      // HIGH — main forecast
  const possiblePerDay = new Map<string, ExpectedTransaction[]>(); // MEDIUM — possible

  const addToDay = (date: string, tx: ExpectedTransaction, isMedium: boolean) => {
    const map = isMedium ? possiblePerDay : perDay;
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(tx);
  };

  // 1. Actuals from this month — these REPLACE pattern estimates on past days.
  const actualsByDate = new Map<string, ExpectedTransaction[]>();
  if (options.actualThisMonth) {
    for (const tx of options.actualThisMonth) {
      if (tx.date < monthStartStr || tx.date > monthEndStr) continue;
      const exp: ExpectedTransaction = {
        merchant: tx.description.length > 60
          ? tx.description.slice(0, 60) + "…"
          : tx.description,
        expectedAmount: tx.amount,
        category: tx.type === "credit" ? "Income" : "",
        subcategory: tx.subcategory ?? "uncategorized",
        recurring: false,
        confidence: 1,
        confidenceTier: "high",
        status: "completed",
        recurrence: null,
      };
      if (!actualsByDate.has(tx.date)) actualsByDate.set(tx.date, []);
      actualsByDate.get(tx.date)!.push(exp);
    }
  }

  // 2. Project recurring vendors from vendorHistory across the current month.
  //    Each vendor that fired in ≥2 of the last 3 complete months gets ONE
  //    projection placed on its mode day-of-month, with amount equal to its
  //    avg-monthly-total across those months. This is the SAME data the
  //    hybrid forecaster uses, so chart_sum == hybrid.recurring naturally —
  //    no post-pass scaling required.
  if (options.vendorHistory && options.recentCompleteMonths && options.recentCompleteMonths.length > 0) {
    const recent = options.recentCompleteMonths;
    const monthKey = today.slice(0, 7);
    for (const vendor of options.vendorHistory) {
      const firedCount = recent.filter(
        (m) => Math.abs(vendor.monthlyTotals[m] ?? 0) > 0.005
      ).length;
      if (firedCount < 2) continue;
      const sumAcross = recent.reduce(
        (s, m) => s + (vendor.monthlyTotals[m] ?? 0),
        0
      );
      const avg = sumAcross / recent.length;
      if (Math.abs(avg) < 0.005) continue;
      // Direction: vendor.direction determines income/expense bucket.
      // "mixed" is rare (post-dominance test) — bucket by sign of avg.
      const direction: "income" | "expense" =
        vendor.direction === "income"
          ? "income"
          : vendor.direction === "expense"
            ? "expense"
            : avg >= 0
              ? "income"
              : "expense";

      // Pick the placement day-of-month.
      let dayOfMonth = vendor.typicalDayOfMonth;
      if (dayOfMonth == null && vendor.occurrenceDates && vendor.occurrenceDates.length > 0) {
        // Fallback: median UTC day across occurrence dates.
        const occDays = vendor.occurrenceDates
          .map((d) => new Date(d + "T00:00:00Z").getUTCDate())
          .filter((d) => d >= 1 && d <= 31)
          .sort((a, b) => a - b);
        if (occDays.length > 0) dayOfMonth = occDays[Math.floor(occDays.length / 2)];
      }
      if (dayOfMonth == null) continue;

      // Clamp to the actual length of the current month.
      const lastDay = new Date(
        Date.UTC(
          parseInt(monthKey.slice(0, 4), 10),
          parseInt(monthKey.slice(5, 7), 10),
          0
        )
      ).getUTCDate();
      const placementDay = Math.min(dayOfMonth, lastDay);
      const placementDate = `${monthKey}-${String(placementDay).padStart(2, "0")}`;

      // If the placement date is in the past AND an actual already covers
      // this vendor on that date, skip (actual wins).
      if (placementDate < today) {
        const existing = actualsByDate.get(placementDate);
        if (existing && existing.length > 0) {
          const merch = vendor.canonicalName.toLowerCase();
          const overlap = existing.some(
            (t) =>
              t.merchant.toLowerCase().includes(merch) ||
              merch.includes(t.merchant.toLowerCase())
          );
          if (overlap) continue;
        }
      }

      const amount = Math.abs(avg);
      const projection: ExpectedTransaction = {
        merchant: vendor.canonicalName,
        expectedAmount: amount,
        category: direction === "income" ? "Income" : "",
        subcategory: direction === "income" ? "property-income" : "supplier-payments",
        recurring: true,
        confidence: 0.8,
        confidenceTier: "high",
        status: placementDate < today ? "late" : "expected",
        recurrence: null,
      };
      addToDay(placementDate, projection, false);
    }
  }

  // 3. Determine the month-start balance.
  // If caller didn't pass one explicitly, walk backwards: subtract net of
  // actuals from monthStart up to today to derive monthStartBalance.
  let monthStartBalance = options.monthStartBalance;
  if (monthStartBalance == null) {
    let netSinceMonthStart = 0;
    for (const [date, txs] of actualsByDate) {
      if (date >= monthStartStr && date < today) {
        for (const t of txs) {
          netSinceMonthStart += t.category === "Income" ? t.expectedAmount : -t.expectedAmount;
        }
      }
    }
    monthStartBalance = currentBalance - netSinceMonthStart;
  }

  // 4. Iterate every day from monthStart to monthEnd.
  let balance = monthStartBalance;
  const highConfidenceExpenses = patterns.recurringExpenses.filter(p => p.confidenceTier === "high");
  const totalExpectedExpenses = highConfidenceExpenses.reduce((s, p) => s + p.typicalAmount, 0);

  // Daily chart shows recurring-only — no per-day synthetic buffer. The
  // non-recurring "typical other activity" is now displayed as a single
  // summary line after the daily list (see UI). The forecaster only
  // produces clean recurring days here.
  for (let d = new Date(monthStart); d <= monthEnd; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = formatDate(d);
    const isPast = dateStr < today;

    // Past days: prefer actuals; fall back to recurring projections so the
    // user sees an expected pattern even when no statement covers that day.
    // Future days: recurring projections only.
    const actualsToday = actualsByDate.get(dateStr) ?? [];
    const recurringHigh = perDay.get(dateStr) ?? [];
    const recurringMed = possiblePerDay.get(dateStr) ?? [];
    const dayTxs = isPast
      ? (actualsToday.length > 0 ? actualsToday : recurringHigh)
      : recurringHigh;
    const possibleTxs = isPast
      ? (actualsToday.length > 0 ? [] : recurringMed)
      : recurringMed;

    const highIncome = dayTxs.reduce((s, t) => s + (t.category === "Income" ? t.expectedAmount : 0), 0);
    const highExpenses = dayTxs.reduce((s, t) => s + (t.category !== "Income" ? t.expectedAmount : 0), 0);
    const medIncome = possibleTxs.reduce((s, t) => s + (t.category === "Income" ? t.expectedAmount : 0), 0);
    const medExpenses = possibleTxs.reduce((s, t) => s + (t.category !== "Income" ? t.expectedAmount : 0), 0);

    const opening = balance;
    const closing = opening + highIncome - highExpenses;

    const riskFlag = !isPast && closing < totalExpectedExpenses * 0.2;
    const riskMessage = riskFlag
      ? (dayTxs.length > 0
        ? `Low balance — ${dayTxs.map(t => t.merchant).slice(0, 2).join(", ")} expected`
        : "Balance drops below safety threshold")
      : undefined;

    days.push({
      date: dateStr,
      openingBalance: opening,
      expectedIncome: highIncome,
      expectedExpenses: highExpenses,
      mediumConfidenceIncome: medIncome,
      mediumConfidenceExpenses: medExpenses,
      closingBalance: closing,
      transactions: dayTxs,
      possibleUpcoming: possibleTxs,
      riskFlag,
      riskMessage,
      transactionCount: dayTxs.length + possibleTxs.length,
    });

    balance = closing;
  }

  return days;
}
