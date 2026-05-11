import type { DailyForecast } from "./daily-forecaster";

export interface RiskItem {
  type: "low-balance-window" | "large-payment" | "payment-cluster" | "no-income";
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  relatedDates: string[];
  actionable: string;
}

export function detectRisks(
  dailyForecast: DailyForecast[],
  nextIncomeDate?: string | null,
  nextIncomeVendor?: string
): RiskItem[] {
  const risks: RiskItem[] = [];
  const threshold = 500;

  // Low balance windows — with specific context
  let lowWindowStart: string | null = null;
  let lowestInWindow = Infinity;
  let lowWindowDays: DailyForecast[] = [];
  for (const day of dailyForecast) {
    if (day.closingBalance < threshold) {
      if (!lowWindowStart) lowWindowStart = day.date;
      lowestInWindow = Math.min(lowestInWindow, day.closingBalance);
      lowWindowDays.push(day);
    } else if (lowWindowStart) {
      const endDate = day.date;
      const duration = lowWindowDays.length;

      // Find the biggest expense day in the window
      const biggestExpenseDay = lowWindowDays.reduce((max, d) =>
        d.expectedExpenses > max.expectedExpenses ? d : max, lowWindowDays[0]);

      // Build specific description
      let desc = `Balance drops as low as ${formatCurrencyStatic(lowestInWindow)} between ${lowWindowStart} and ${endDate}`;

      if (biggestExpenseDay.transactions.length > 0) {
        const topPayments = biggestExpenseDay.transactions
          .slice(0, 3)
          .map(t => `${t.merchant} (${formatCurrencyStatic(t.expectedAmount)})`)
          .join(", ");
        desc += `. Largest payment day: ${biggestExpenseDay.date} — ${topPayments}`;
      }

      if (nextIncomeDate && nextIncomeDate > lowWindowStart) {
        const recoveryContext = nextIncomeVendor
          ? `${nextIncomeVendor} payments`
          : "next income";
        desc += `. Balance expected to remain below threshold until ${recoveryContext} arrive around ${nextIncomeDate}`;
      }

      let actionable = "";
      if (duration >= 5) {
        actionable = `Low balance window lasts ${duration} days. Consider rescheduling non-critical payments or arranging short-term funding.`;
      } else {
        actionable = `Short low-balance window (${duration} days). Monitor closely but may not require action.`;
      }

      risks.push({
        type: "low-balance-window",
        title: `Low balance: ${lowWindowStart} — ${endDate} (${duration} days)`,
        description: desc,
        severity: lowestInWindow < 0 ? "high" : lowestInWindow < 200 ? "medium" : "low",
        relatedDates: [lowWindowStart, endDate],
        actionable,
      });
      lowWindowStart = null;
      lowestInWindow = Infinity;
      lowWindowDays = [];
    }
  }

  // Handle window that extends to end of forecast
  if (lowWindowStart && lowWindowDays.length > 0) {
    const endDate = lowWindowDays[lowWindowDays.length - 1].date;
    const duration = lowWindowDays.length;
    let desc = `Balance drops as low as ${formatCurrencyStatic(lowestInWindow)} from ${lowWindowStart} through month-end`;
    if (nextIncomeDate && nextIncomeDate > lowWindowStart) {
      desc += `. Next income expected around ${nextIncomeDate}`;
    }
    risks.push({
      type: "low-balance-window",
      title: `Low balance through month-end (${duration} days)`,
      description: desc,
      severity: lowestInWindow < 0 ? "high" : "medium",
      relatedDates: [lowWindowStart, endDate],
      actionable: "Review upcoming payments and ensure sufficient funds before month-end.",
    });
  }

  // Large payment days — with vendor names
  for (const day of dailyForecast) {
    if (day.expectedExpenses > 1000) {
      const topItems = day.transactions
        .slice(0, 5)
        .map(t => `${t.merchant}: ${formatCurrencyStatic(t.expectedAmount)}`)
        .join(", ");
      risks.push({
        type: "large-payment",
        title: `Large payment day: ${day.date}`,
        description: `${formatCurrencyStatic(day.expectedExpenses)} in payments — ${topItems}`,
        severity: day.closingBalance < 0 ? "high" : "medium",
        relatedDates: [day.date],
        actionable: `Ensure at least ${formatCurrencyStatic(day.expectedExpenses + threshold)} in balance before ${day.date}`,
      });
    }
  }

  // Payment clusters
  for (const day of dailyForecast) {
    if (day.transactions.length >= 3 && day.expectedExpenses > 500) {
      const items = day.transactions.map(t => t.merchant).join(", ");
      risks.push({
        type: "payment-cluster",
        title: `Payment cluster: ${day.date}`,
        description: `${day.transactions.length} payments (${items}) totaling ${formatCurrencyStatic(day.expectedExpenses)}`,
        severity: day.closingBalance < 0 ? "medium" : "low",
        relatedDates: [day.date],
        actionable: "Consider spreading these payments across different days to smooth cashflow",
      });
    }
  }

  return risks;
}

function formatCurrencyStatic(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return amount < 0 ? `-£${formatted}` : `£${formatted}`;
}
