"use client";

import type { MonthEndForecast } from "@/lib/forecast";

interface RecommendedActionsProps {
  forecast: MonthEndForecast | null;
  currentBalance: number | null;
}

function generateRecommendations(
  forecast: MonthEndForecast | null,
  currentBalance: number | null
): Array<{ title: string; description: string; urgency: "high" | "medium" | "low" }> {
  const recommendations: Array<{ title: string; description: string; urgency: "high" | "medium" | "low" }> = [];

  if (!forecast) {
    recommendations.push({
      title: "Upload a recent statement",
      description: "We need your latest bank statement to generate an accurate forecast. Upload your most recent statement to get started.",
      urgency: "high",
    });
    return recommendations;
  }

  // Critical status recommendations
  if (forecast.status === "critical") {
    recommendations.push({
      title: "Immediate cash flow risk",
      description: `Your balance is projected to drop below zero${forecast.dangerWindow ? ` around ${forecast.dangerWindow.from.slice(5)}` : ""}. Review all upcoming expenses and consider delaying non-essential payments.`,
      urgency: "high",
    });
    if (forecast.nextIncomeDate) {
      recommendations.push({
        title: "Bridge to next income",
        description: `Next income expected around ${new Date(forecast.nextIncomeDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}. Ensure essential payments are covered until then.`,
        urgency: "high",
      });
    }
  }

  // Risk status recommendations
  if (forecast.status === "risk") {
    recommendations.push({
      title: "Monitor daily balance closely",
      description: "Your balance may dip below zero on some days. Review the daily forecast to identify risky periods and plan payments accordingly.",
      urgency: "medium",
    });
    const largeExpenses = forecast.biggestRisks.filter(r => r.type === "large-payment");
    if (largeExpenses.length > 0) {
      recommendations.push({
        title: `Large payment: ${largeExpenses[0].title}`,
        description: largeExpenses[0].actionable || largeExpenses[0].description,
        urgency: "medium",
      });
    }
  }

  // Watch status recommendations
  if (forecast.status === "watch") {
    recommendations.push({
      title: "Build a larger buffer",
      description: "Your balance covers expected expenses but with less than 20% margin. Consider reducing discretionary spending or accelerating income collection.",
      urgency: "low",
    });
  }

  // General recommendations for all statuses
  if (forecast.remainingExpenses > 0 && forecast.remainingIncome === 0) {
    recommendations.push({
      title: "No expected income remaining",
      description: "No income is expected before month-end. Ensure your current balance can cover all remaining expenses.",
      urgency: forecast.status === "safe" ? "low" : "medium",
    });
  }

  // Confidence-based recommendation
  if (forecast.confidence < 0.5) {
    recommendations.push({
      title: "Improve forecast accuracy",
      description: `Current forecast confidence is ${Math.round(forecast.confidence * 100)}%. Upload more historical statements to improve pattern recognition and forecast reliability.`,
      urgency: "low",
    });
  }

  // Check for no-income risk
  const noIncomeRisk = forecast.biggestRisks.find(r => r.type === "no-income");
  if (noIncomeRisk) {
    recommendations.push({
      title: "No income pattern detected",
      description: noIncomeRisk.actionable || "We couldn't detect reliable income patterns. Upload more statements showing regular income to improve forecasts.",
      urgency: "medium",
    });
  }

  // If balance is null/unavailable
  if (currentBalance === null) {
    recommendations.push({
      title: "Upload a bank statement",
      description: "Your current balance is unavailable. Upload your latest statement to see your cash position and forecast.",
      urgency: "high",
    });
  }

  return recommendations;
}

export function RecommendedActions({ forecast, currentBalance }: RecommendedActionsProps) {
  const recommendations = generateRecommendations(forecast, currentBalance);

  if (recommendations.length === 0) return null;

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-3">
        Recommended actions
      </h3>
      <div className="space-y-2">
        {recommendations.map((rec, i) => (
          <div
            key={i}
            className={`rounded-lg p-3 border-l-3 ${
              rec.urgency === "high"
                ? "border-l-red-500 bg-red-50/50"
                : rec.urgency === "medium"
                ? "border-l-amber-500 bg-amber-50/50"
                : "border-l-zinc-300 bg-zinc-50"
            }`}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${
                rec.urgency === "high" ? "bg-red-500" : rec.urgency === "medium" ? "bg-amber-500" : "bg-zinc-400"
              }`} />
              <span className="text-xs font-medium text-zinc-900">{rec.title}</span>
            </div>
            <p className="text-xs text-zinc-500 ml-3.5">{rec.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
