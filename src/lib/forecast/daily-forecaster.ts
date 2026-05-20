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
   * Target month-end balance from the headline forecast. When provided, the
   * daily chart adds a daily "Typical other activity" line whose total
   * exactly closes the gap between the recurring-only trajectory and this
   * target. Result: daily chart's final closing balance matches the headline.
   */
  targetMonthEndBalance?: number;

  /**
   * If provided, the SUM of expectedIncome across FUTURE days (today onward)
   * is scaled so it equals targetRecurringIncome — guaranteeing the chart's
   * total future income matches the headline recurring income exactly. Same
   * for expenses. Past days (actuals) are not touched.
   */
  targetRecurringIncome?: number;
  targetRecurringExpenses?: number;
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

  // Post-pass: scale recurring-projection days so the chart's final closing
  // balance matches the headline's recurringProjectedMonthEnd exactly.
  //
  // Rules:
  //   - Past days that show ACTUAL transactions (from statement) are not
  //     touched — those are facts.
  //   - Past days that show recurring PROJECTIONS (no actuals available) AND
  //     future days are scaled. Together they are the "recurring component".
  //
  // We scale income and expense channels independently so the chart totals
  // align with hybridForecast.recurring.income / .expenses.
  if (
    options.targetRecurringIncome != null ||
    options.targetRecurringExpenses != null
  ) {
    // Identify "recurring projection" days = days where the displayed txs
    // come from projections (no actual was found for that date).
    const isProjectionDay = (d: DailyForecast): boolean => {
      const dateStr = d.date;
      const actualsHere = actualsByDate.get(dateStr) ?? [];
      // Future days never have actuals — always projections.
      if (dateStr >= today) return true;
      // Past days WITH actuals are kept as-is.
      return actualsHere.length === 0;
    };

    const projectionDays = days.filter(isProjectionDay);
    const projIncomeSum = projectionDays.reduce((s, d) => s + d.expectedIncome, 0);
    const projExpenseSum = projectionDays.reduce((s, d) => s + d.expectedExpenses, 0);

    const incomeScale =
      options.targetRecurringIncome != null && projIncomeSum > 0
        ? options.targetRecurringIncome / projIncomeSum
        : 1;
    const expenseScale =
      options.targetRecurringExpenses != null && projExpenseSum > 0
        ? options.targetRecurringExpenses / projExpenseSum
        : 1;

    if (incomeScale !== 1 || expenseScale !== 1) {
      const rescale = (tx: ExpectedTransaction) => {
        const scale = tx.category === "Income" ? incomeScale : expenseScale;
        tx.expectedAmount = tx.expectedAmount * scale;
      };
      // Rebuild day-by-day with scaled amounts so opening/closing chain stays
      // internally consistent (validator: opening + income - expenses = closing).
      let runningBalance = days[0]?.openingBalance ?? monthStartBalance;
      for (const day of days) {
        if (isProjectionDay(day)) {
          day.transactions.forEach(rescale);
          day.possibleUpcoming.forEach(rescale);
          day.expectedIncome *= incomeScale;
          day.expectedExpenses *= expenseScale;
          day.mediumConfidenceIncome *= incomeScale;
          day.mediumConfidenceExpenses *= expenseScale;
        }
        day.openingBalance = runningBalance;
        day.closingBalance = runningBalance + day.expectedIncome - day.expectedExpenses;
        runningBalance = day.closingBalance;
      }
    }
  }

  return days;
}
