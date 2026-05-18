// ── Core Transaction ──

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  category?: string;
  balance?: number;
  merchant?: string;
  cardholder?: string;
  direction?: "income" | "expense";
  subcategory?: string;
  payment_method?: string;
  reference?: string;
}

// ── Statement Data ──

export interface StatementData {
  transactions: Transaction[];
  accountInfo: {
    bankName?: string;
    accountNumber?: string;
    statementPeriod?: { from: string; to: string };
    openingBalance?: number;
    closingBalance?: number;
    totalPaidIn?: number;
    totalWithdrawn?: number;
  };
  summary: {
    totalCredits: number;
    totalDebits: number;
    netFlow: number;
    transactionCount: number;
    averageDebit: number;
    averageCredit: number;
  };
  monthlyBreakdown: MonthlyBreakdown[];
  categoryBreakdown: CategoryBreakdown[];
}

export interface MonthlyBreakdown {
  month: string;
  credits: number;
  debits: number;
  netFlow: number;
  transactionCount: number;
}

export interface CategoryBreakdown {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

// ── Personal Finance Insights (unchanged) ──

export interface AIInsights {
  spendingPatterns: string[];
  unusualActivity: string[];
  savingsOpportunities: string[];
  monthlyForecast: {
    projectedBalance: number;
    projectedIncome: number;
    projectedExpenses: number;
    confidence: number;
    narrative: string;
  };
  cashFlowHealth: "excellent" | "good" | "fair" | "concerning";
  topRecommendations: string[];
}

// ── Shared Enums ──

export type AnalysisMode = "personal" | "business";
export type Severity = "Critical" | "High" | "Medium" | "Low";
export type Confidence = "High" | "Medium" | "Low";

// ── Pass 1: Detection Engine Types ──

export interface CandidateFinding {
  detection_case_id: number;
  title: string;
  category: string;
  severity: Severity;
  confidence: Confidence;
  merchant_names: string[];
  transaction_ids: string[];
  amount_at_risk: number;
  frequency: string;
  date_pattern: string;
  evidence_summary: string;
  grouped_transactions: GroupedTransactionBlock[];
}

export interface GroupedTransactionBlock {
  group_title: string;
  group_reason: string;
  total_value: number;
  transaction_count: number;
  transactions: EnrichedTransaction[];
}

export interface EnrichedTransaction {
  id: string;
  date: string;
  merchant: string;
  description: string;
  amount: number;
  direction: "income" | "expense";
  cardholder: string;
  category: string;
}

// ── Pass 2: AI Insight Types (replaces old BusinessInsight) ──

export interface InsightEvidence {
  merchant_names: string[];
  date_pattern: string;
  frequency: string;
  amount_pattern: string;
  total_value: number;
  sample_transactions: EnrichedTransaction[];
}

export interface DrilldownSection {
  title: string;
  content: string;
}

export interface SuggestedFilters {
  merchant: string;
  category: string;
  cardholder: string;
  date_from: string;
  date_to: string;
}

export interface Insight {
  id: string;
  short_title: string;
  one_line_summary: string;
  category: string;
  severity: Severity;
  confidence: Confidence;
  detection_case_ids: number[];
  amount_at_risk: number;
  estimated_monthly_impact: number;
  estimated_annual_impact: number;
  why_flagged: string;
  why_it_matters: string;
  possible_legitimate_explanation: string;
  recommended_action: string;
  owner_question: string;
  transaction_ids: string[];
  evidence: InsightEvidence;
  grouped_transactions: GroupedTransactionBlock[];
  drilldown_sections: DrilldownSection[];
  ui_badges: string[];
  suggested_filters: SuggestedFilters;
}

// ── Pass 2: Top-Level Response ──

export interface QuickAction {
  label: string;
  description: string;
  related_insight_ids: string[];
}

export interface OwnerReviewItem {
  priority: number;
  item: string;
  amount: number;
  reason: string;
  suggested_question: string;
  related_insight_id: string;
}

export interface MissingDataItem {
  field: string;
  why_it_would_help: string;
}

export interface ExecutiveSummary {
  headline: string;
  plain_english_summary: string;
  total_transactions_reviewed: number;
  date_range: {
    from: string;
    to: string;
  };
  total_income: number;
  total_expenses: number;
  net_cash_flow: number;
  items_to_review: number;
  estimated_monthly_savings: {
    amount: number;
    confidence: Confidence;
    explanation: string;
  };
  top_3_findings: {
    insight_id: string;
    title: string;
    why_it_matters: string;
    amount_at_risk: number;
  }[];
}

export interface SpendReviewResult {
  analysis_type: "business_spend_review";
  executive_summary: ExecutiveSummary;
  insights: Insight[];
  quick_actions: QuickAction[];
  owner_review_pack: OwnerReviewItem[];
  missing_data: MissingDataItem[];
}

// ── API ──

export interface ParseResult {
  success: boolean;
  data?: StatementData;
  error?: string;
  parser: "pdf" | "csv";
  fileName: string;
}

// ── Forecast Types ──

export type ForecastStatus = "safe" | "watch" | "risk" | "critical";

export type Subcategory =
  | "salary" | "subscriptions" | "software" | "car-expenses"
  | "rent" | "taxes" | "loans" | "supplier-payments"
  | "utilities" | "bank-fees" | "insurance" | "marketing"
  | "travel" | "office-supplies" | "professional-services"
  | "supplies" | "director-loans" | "property-management" | "property-income"
  | "food-dining"
  | "one-off" | "uncategorized";

export interface CurrentPosition {
  balance: number | null;
  date: string | null;
  source: "statement" | "catchUp" | "unavailable";
  isEstimated: boolean;
  isStale: boolean;
  statementPeriodEnd: string | null;
}

export interface AccumulatedPerformance {
  totalIncome: number;
  totalExpenses: number;
  netFlow: number;
  statementCount: number;
  totalTransactions: number;
  dateRange: { from: string; to: string } | null;
}

export interface BalanceValidationResult {
  valid: boolean;
  message: string;
}
