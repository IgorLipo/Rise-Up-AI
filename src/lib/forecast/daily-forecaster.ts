import type { RecurringPayment } from "@/lib/detection/pattern-detector";
import type { EnrichedDetectedPatterns } from "@/lib/detection";

export interface ExpectedTransaction {
  merchant: string;
  expectedAmount: number;
  category: string;
  subcategory: string;
  recurring: boolean;
  confidence: number;
  recurrence: RecurringPayment | null;
}

export interface DailyForecast {
  date: string;
  openingBalance: number;
  expectedIncome: number;
  expectedExpenses: number;
  closingBalance: number;
  transactions: ExpectedTransaction[];
  riskFlag: boolean;
  riskMessage?: string;
}

function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function generateDailyForecast(
  patterns: EnrichedDetectedPatterns,
  currentBalance: number,
  today: string = formatDate(new Date())
): DailyForecast[] {
  const monthEnd = getMonthEnd(new Date(today));
  const startDate = new Date(today);
  const days: DailyForecast[] = [];

  // Build map of expected transactions per day
  const perDay = new Map<string, ExpectedTransaction[]>();
  const addToDay = (date: string, tx: ExpectedTransaction) => {
    if (!perDay.has(date)) perDay.set(date, []);
    perDay.get(date)!.push(tx);
  };

  for (const payment of patterns.recurringExpenses) {
    if (payment.nextExpected <= formatDate(monthEnd)) {
      addToDay(payment.nextExpected, {
        merchant: payment.merchant,
        expectedAmount: payment.typicalAmount,
        category: "",
        subcategory: (payment as any).subcategory ?? "one-off",
        recurring: true,
        confidence: payment.confidence,
        recurrence: payment,
      });
    }
  }

  for (const income of patterns.recurringIncome) {
    if (income.nextExpected <= formatDate(monthEnd)) {
      addToDay(income.nextExpected, {
        merchant: income.merchant,
        expectedAmount: income.typicalAmount,
        category: "Income",
        subcategory: "salary",
        recurring: true,
        confidence: income.confidence,
        recurrence: income,
      });
    }
  }

  let balance = currentBalance;
  const totalExpectedExpenses = patterns.recurringExpenses.reduce((s, p) => s + p.typicalAmount, 0);

  for (let d = new Date(startDate); d <= monthEnd; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d);
    const dayTxs = perDay.get(dateStr) ?? [];
    const income = dayTxs.reduce((s, t) => s + (t.category === "Income" ? t.expectedAmount : 0), 0);
    const expenses = dayTxs.reduce((s, t) => s + (t.category !== "Income" ? t.expectedAmount : 0), 0);
    const opening = balance;
    const closing = opening + income - expenses;

    const riskFlag = closing < totalExpectedExpenses * 0.2;
    const riskMessage = riskFlag
      ? `Balance drops below 20% of expected monthly expenses`
      : undefined;

    days.push({
      date: dateStr,
      openingBalance: opening,
      expectedIncome: income,
      expectedExpenses: expenses,
      closingBalance: closing,
      transactions: dayTxs,
      riskFlag,
      riskMessage,
    });

    balance = closing;
  }

  return days;
}
