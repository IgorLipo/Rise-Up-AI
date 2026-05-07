import type { DailyForecast } from "./daily-forecaster";

export interface RiskItem {
  type: "low-balance-window" | "large-payment" | "payment-cluster" | "no-income";
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  relatedDates: string[];
  actionable: string;
}

export function detectRisks(dailyForecast: DailyForecast[]): RiskItem[] {
  const risks: RiskItem[] = [];
  const threshold = 500;

  // Low balance windows
  let lowWindowStart: string | null = null;
  let lowestInWindow = Infinity;
  for (const day of dailyForecast) {
    if (day.closingBalance < threshold) {
      if (!lowWindowStart) lowWindowStart = day.date;
      lowestInWindow = Math.min(lowestInWindow, day.closingBalance);
    } else if (lowWindowStart) {
      risks.push({
        type: "low-balance-window",
        title: `Low balance: ${lowWindowStart} — ${day.date}`,
        description: `Balance drops as low as ${formatCurrencyStatic(lowestInWindow)} during this window`,
        severity: lowestInWindow < 0 ? "high" : "medium",
        relatedDates: [lowWindowStart, day.date],
        actionable: "Review upcoming payments and consider delaying non-critical ones",
      });
      lowWindowStart = null;
      lowestInWindow = Infinity;
    }
  }

  // Large payment days
  for (const day of dailyForecast) {
    if (day.expectedExpenses > 1000) {
      risks.push({
        type: "large-payment",
        title: `Large payment day: ${day.date}`,
        description: `£${day.expectedExpenses.toFixed(0)} in payments expected — ${day.transactions.length} transaction(s)`,
        severity: day.closingBalance < 0 ? "high" : "medium",
        relatedDates: [day.date],
        actionable: "Ensure sufficient balance before this date",
      });
    }
  }

  // Payment clusters (3+ transactions in one day)
  for (const day of dailyForecast) {
    if (day.transactions.length >= 3 && day.expectedExpenses > 500) {
      risks.push({
        type: "payment-cluster",
        title: `Payment cluster: ${day.date}`,
        description: `${day.transactions.length} payments totaling £${day.expectedExpenses.toFixed(0)} on the same day`,
        severity: "low",
        relatedDates: [day.date],
        actionable: "Consider spreading payments across different days",
      });
    }
  }

  return risks;
}

function formatCurrencyStatic(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return amount < 0 ? `-£${formatted}` : `£${formatted}`;
}
