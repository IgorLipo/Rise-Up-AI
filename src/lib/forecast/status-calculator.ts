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

  // Critical: balance goes negative AND no income before that happens
  if (lowestBalance < 0) {
    if (nextIncomeDate) {
      const firstNegativeDay = dailyForecast.find((d) => d.closingBalance < 0);
      if (firstNegativeDay && nextIncomeDate > firstNegativeDay.date) {
        return {
          status: "critical",
          reason: `Balance goes negative on ${firstNegativeDay.date} before next income on ${nextIncomeDate}`,
        };
      }
    }
    return { status: "risk", reason: "Balance projected to go negative before month-end" };
  }

  // Risk: balance drops below 20% threshold
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
