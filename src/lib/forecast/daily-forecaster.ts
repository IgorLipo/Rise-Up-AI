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

export function generateDailyForecast(
  patterns: EnrichedDetectedPatterns,
  currentBalance: number,
  today: string = formatDate(new Date())
): DailyForecast[] {
  const monthEnd = getMonthEnd(new Date(today));
  const startDate = new Date(today);
  const days: DailyForecast[] = [];

  // Build maps of expected transactions per day, separated by tier
  const perDay = new Map<string, ExpectedTransaction[]>();      // HIGH — main forecast
  const possiblePerDay = new Map<string, ExpectedTransaction[]>(); // MEDIUM — possible

  const addToDay = (date: string, tx: ExpectedTransaction, isMedium: boolean) => {
    const map = isMedium ? possiblePerDay : perDay;
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(tx);
  };

  // Helper to build ExpectedTransaction
  function buildTx(
    payment: RecurringPayment,
    category: string,
    subcategory: string
  ): ExpectedTransaction {
    return {
      merchant: payment.merchant,
      expectedAmount: payment.typicalAmount,
      category,
      subcategory,
      recurring: true,
      confidence: payment.confidence,
      confidenceTier: payment.confidenceTier,
      status: determineStatus(payment, today, formatDate(monthEnd)),
      recurrence: payment,
    };
  }

  for (const payment of patterns.recurringExpenses) {
    // Skip LOW confidence entirely
    if (payment.confidenceTier === "low") continue;

    if (payment.nextExpected <= formatDate(monthEnd)) {
      const tx = buildTx(payment, "", (payment as any).subcategory ?? "uncategorized");
      addToDay(payment.nextExpected, tx, payment.confidenceTier === "medium");
    }
  }

  for (const income of patterns.recurringIncome) {
    if (income.confidenceTier === "low") continue;

    if (income.nextExpected <= formatDate(monthEnd)) {
      const tx = buildTx(income, "Income", "salary");
      addToDay(income.nextExpected, tx, income.confidenceTier === "medium");
    }
  }

  let balance = currentBalance;
  const highConfidenceExpenses = patterns.recurringExpenses
    .filter(p => p.confidenceTier === "high");
  const totalExpectedExpenses = highConfidenceExpenses.reduce((s, p) => s + p.typicalAmount, 0);

  for (let d = new Date(startDate); d <= monthEnd; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d);
    const dayTxs = perDay.get(dateStr) ?? [];
    const possibleTxs = possiblePerDay.get(dateStr) ?? [];
    const highIncome = dayTxs.reduce((s, t) => s + (t.category === "Income" ? t.expectedAmount : 0), 0);
    const highExpenses = dayTxs.reduce((s, t) => s + (t.category !== "Income" ? t.expectedAmount : 0), 0);
    const medIncome = possibleTxs.reduce((s, t) => s + (t.category === "Income" ? t.expectedAmount : 0), 0);
    const medExpenses = possibleTxs.reduce((s, t) => s + (t.category !== "Income" ? t.expectedAmount : 0), 0);
    const income = highIncome + medIncome;
    const expenses = highExpenses + medExpenses;
    const opening = balance;
    const closing = opening + income - expenses;

    const riskFlag = closing < totalExpectedExpenses * 0.2;
    const riskMessage = riskFlag
      ? (dayTxs.length > 0
        ? `Low balance — ${dayTxs.map(t => t.merchant).slice(0, 2).join(", ")} expected`
        : "Balance drops below safety threshold")
      : undefined;

    days.push({
      date: dateStr,
      openingBalance: opening,
      expectedIncome: income,
      expectedExpenses: expenses,
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
