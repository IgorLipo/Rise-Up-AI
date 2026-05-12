import type { DailyForecast } from "./daily-forecaster";

export type ForecastStatus = "safe" | "watch" | "risk" | "critical";

export function calculateStatus(
  dailyForecast: DailyForecast[],
  totalMonthlyExpenses: number,
  nextIncomeDate: string | null
): { status: ForecastStatus; reason: string } {
  if (dailyForecast.length === 0) {
    return { status: "safe", reason: "No forecast data available" };
  }

  const threshold = totalMonthlyExpenses * 0.2;
  const lowestBalance = Math.min(...dailyForecast.map((d) => d.closingBalance));
  const monthEndBalance = dailyForecast[dailyForecast.length - 1].closingBalance;

  // Critical: would end month negative
  if (monthEndBalance < 0) {
    return {
      status: "critical",
      reason: `Projected to end month at ${formatCurrencyStatic(monthEndBalance)} — action needed`,
    };
  }

  // Risk: dips negative temporarily but recovers, or drops below safety threshold
  if (lowestBalance < 0) {
    return {
      status: "risk",
      reason: `Balance temporarily dips negative but recovers to ${formatCurrencyStatic(monthEndBalance)} by month-end — monitor cashflow timing`,
    };
  }

  if (lowestBalance < threshold) {
    const lowDay = dailyForecast.find((d) => d.closingBalance === lowestBalance);
    return {
      status: "risk",
      reason: `Balance drops to ${formatCurrencyStatic(lowestBalance)} on ${lowDay?.date} — below 20% safety threshold`,
    };
  }

  // Watch: balance dips below 2x threshold
  if (lowestBalance < threshold * 2) {
    return { status: "watch", reason: "Balance approaches the safety threshold — monitor closely" };
  }

  // Safe
  return { status: "safe", reason: `Projected month-end balance: ${formatCurrencyStatic(monthEndBalance)}` };
}

function formatCurrencyStatic(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return amount < 0 ? `-£${formatted}` : `£${formatted}`;
}
