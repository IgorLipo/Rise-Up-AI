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

  /**
   * Net buffer (income - expenses) of typical NON-RECURRING / non-property
   * activity expected this month. Spread evenly across remaining days so the
   * daily chart's closing balance reconciles with the property-aware headline.
   *
   * Without this, the daily chart only shows detected recurring vendors —
   * which on this user's data lean optimistic by ~£28k because the recurring
   * detector under-counts the small/irregular expenses.
   */
  nonRecurringBufferNet?: number;
  nonRecurringBufferIncome?: number;
  nonRecurringBufferExpenses?: number;
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

  // 2. Project recurring patterns across the WHOLE current month so that
  //    past days without actual coverage (e.g. the statement period ended
  //    before today) still show predictions. For each recurring pattern,
  //    derive the day-of-month it typically lands on from its history and
  //    place a projection on that date — unless an actual already sits there.
  function placeRecurringAcrossMonth(
    payment: RecurringPayment,
    direction: "income" | "expense"
  ) {
    if (payment.confidenceTier === "low") return;
    const sub = (payment as { subcategory?: string }).subcategory
      ?? (direction === "income" ? "property-income" : "supplier-payments");

    // A recurring pattern fires ONCE per month. Compute its typical day-of-
    // month from history: use the MODE (most common day). If equally split,
    // use the median. Previous version placed one projection per UNIQUE day
    // the vendor ever appeared — for vendors with variable timing this
    // duplicated income/expenses, blowing the forecast up by 5-10x.
    const dayCounts = new Map<number, number>();
    for (const o of payment.occurrences) {
      const d = new Date(o.date + "T00:00:00Z").getUTCDate();
      if (d >= 1 && d <= 31) dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1);
    }
    let typicalDay: number | null = null;
    if (dayCounts.size > 0) {
      const sorted = [...dayCounts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
      typicalDay = sorted[0][0];
    } else {
      const d = new Date(payment.nextExpected + "T00:00:00Z").getUTCDate();
      if (d >= 1 && d <= 31) typicalDay = d;
    }
    if (typicalDay == null) return;

    const todayDate = new Date(today + "T00:00:00Z");
    const candidate = new Date(
      Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth(), typicalDay)
    );
    const candidateStr = formatDate(candidate);
    if (candidateStr.slice(0, 7) !== today.slice(0, 7)) return;

    // Skip if an actual from this vendor already covers this month.
    const merch = payment.merchant.toLowerCase();
    for (const [, txs] of actualsByDate) {
      if (
        txs.some(
          (t) =>
            t.merchant.toLowerCase().includes(merch) ||
            merch.includes(t.merchant.toLowerCase())
        )
      ) {
        return;
      }
    }

    addToDay(candidateStr, buildTx(payment, direction, sub), payment.confidenceTier === "medium");
  }
  for (const p of patterns.recurringExpenses) placeRecurringAcrossMonth(p, "expense");
  for (const i of patterns.recurringIncome) placeRecurringAcrossMonth(i, "income");

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

  // Spread the non-recurring buffer evenly across future days. This is what
  // reconciles the daily chart's trajectory with the property-aware headline:
  // recurring vendors are placed on their typical days, but the typical
  // non-recurring income/expense gets distributed daily so the closing
  // balance arrives at the same number as the headline.
  let futureDayCount = 0;
  for (let d2 = new Date(monthStart); d2 <= monthEnd; d2.setDate(d2.getDate() + 1)) {
    if (formatDate(d2) >= today) futureDayCount++;
  }
  const bufferIncomePerDay =
    futureDayCount > 0 ? (options.nonRecurringBufferIncome ?? 0) / futureDayCount : 0;
  const bufferExpensePerDay =
    futureDayCount > 0 ? (options.nonRecurringBufferExpenses ?? 0) / futureDayCount : 0;

  for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
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

    const highIncomeRaw = dayTxs.reduce((s, t) => s + (t.category === "Income" ? t.expectedAmount : 0), 0);
    const highExpensesRaw = dayTxs.reduce((s, t) => s + (t.category !== "Income" ? t.expectedAmount : 0), 0);
    const medIncome = possibleTxs.reduce((s, t) => s + (t.category === "Income" ? t.expectedAmount : 0), 0);
    const medExpenses = possibleTxs.reduce((s, t) => s + (t.category !== "Income" ? t.expectedAmount : 0), 0);

    // Add the non-recurring buffer to future days so the daily trajectory
    // reconciles with the property-aware headline.
    const dailyBufferInc = isPast ? 0 : bufferIncomePerDay;
    const dailyBufferExp = isPast ? 0 : bufferExpensePerDay;
    const highIncome = highIncomeRaw + dailyBufferInc;
    const highExpenses = highExpensesRaw + dailyBufferExp;

    if (!isPast && (dailyBufferInc > 0 || dailyBufferExp > 0)) {
      // Surface the buffer as a single synthetic line item so users can see
      // why their daily balance changes by this amount.
      dayTxs.push({
        merchant: "Typical other activity (avg)",
        expectedAmount: dailyBufferExp - dailyBufferInc,
        category: dailyBufferExp >= dailyBufferInc ? "" : "Income",
        subcategory: "non-recurring-avg",
        recurring: false,
        confidence: 0.5,
        confidenceTier: "medium",
        status: "expected",
        recurrence: null,
      });
    }

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
