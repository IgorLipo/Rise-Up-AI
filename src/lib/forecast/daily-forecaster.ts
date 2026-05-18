import type { RecurringPayment, ConfidenceTier } from "@/lib/detection/pattern-detector";
import type { EnrichedDetectedPatterns } from "@/lib/detection";

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

function hasAlreadyOccurredThisMonth(
  occurrences: { date: string; amount: number }[],
  today: string
): boolean {
  const currentMonth = today.slice(0, 7);
  return occurrences.some(o => o.date.slice(0, 7) === currentMonth);
}

function determineStatus(
  payment: RecurringPayment,
  today: string,
  monthEnd: string
): ForecastItemStatus {
  if (hasAlreadyOccurredThisMonth(payment.occurrences, today)) return "completed";
  if (payment.nextExpected < today) return "late";
  if (payment.nextExpected <= monthEnd) return "expected";
  return "uncertain";
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
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
}

export function generateDailyForecast(
  patterns: EnrichedDetectedPatterns,
  currentBalance: number,
  today: string = formatDate(new Date()),
  options: DailyForecastOptions = {}
): DailyForecast[] {
  const todayDate = new Date(today);
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

  function buildTx(
    payment: RecurringPayment,
    direction: "income" | "expense",
    subcategory: string
  ): ExpectedTransaction {
    return {
      merchant: payment.merchant,
      expectedAmount: payment.typicalAmount,
      category: direction === "income" ? "Income" : "",
      subcategory,
      recurring: true,
      confidence: payment.confidence,
      confidenceTier: payment.confidenceTier,
      status: determineStatus(payment, today, monthEndStr),
      recurrence: payment,
    };
  }

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

  // 2. Projected recurring patterns for FUTURE days (>= today).
  for (const payment of patterns.recurringExpenses) {
    if (payment.confidenceTier === "low") continue;
    const next = payment.nextExpected;
    if (next < today) continue;          // past — actuals cover it
    if (next > monthEndStr) continue;    // outside this month
    const sub = (payment as { subcategory?: string }).subcategory ?? "supplier-payments";
    addToDay(next, buildTx(payment, "expense", sub), payment.confidenceTier === "medium");
  }
  for (const income of patterns.recurringIncome) {
    if (income.confidenceTier === "low") continue;
    const next = income.nextExpected;
    if (next < today) continue;
    if (next > monthEndStr) continue;
    const sub = (income as { subcategory?: string }).subcategory ?? "property-income";
    addToDay(next, buildTx(income, "income", sub), income.confidenceTier === "medium");
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

  for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d);
    const isPast = dateStr < today;

    // Use actuals for past days; recurring estimates for future.
    const dayTxs = isPast
      ? (actualsByDate.get(dateStr) ?? [])
      : (perDay.get(dateStr) ?? []);
    const possibleTxs = isPast ? [] : (possiblePerDay.get(dateStr) ?? []);

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
