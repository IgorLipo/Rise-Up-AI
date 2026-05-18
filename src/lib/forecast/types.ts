// Shared forecast types

export interface MonthlySummary {
  month: string;
  label: string;
  openingBalance: number;
  closingBalance: number;
  totalIncome: number;
  totalExpenses: number;
  netFlow: number;
  transactionCount: number;
  status: "safe" | "watch" | "risk" | "critical";
  completeness?: "complete" | "partial";
  dataFrom?: string;
  dataTo?: string;
}
