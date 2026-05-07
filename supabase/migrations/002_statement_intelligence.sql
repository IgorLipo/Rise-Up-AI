-- Statement history: permanent record of every uploaded bank statement
CREATE TABLE IF NOT EXISTS statement_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  statement_period_start DATE,
  statement_period_end DATE,
  opening_balance NUMERIC(12,2),
  closing_balance NUMERIC(12,2),
  total_income NUMERIC(12,2) DEFAULT 0,
  total_expenses NUMERIC(12,2) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  net_flow NUMERIC(12,2) DEFAULT 0,
  parse_status TEXT DEFAULT 'ok' CHECK (parse_status IN ('ok', 'partial', 'failed')),
  duplicate_detected BOOLEAN DEFAULT false,
  duplicate_of UUID REFERENCES statement_history(id)
);

-- Enriched vendor intelligence: full profiles, not just category labels
CREATE TABLE IF NOT EXISTS vendor_intel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  canonical_name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  subcategory TEXT NOT NULL,
  category TEXT,
  typical_amount_min NUMERIC(12,2),
  typical_amount_max NUMERIC(12,2),
  typical_amount_avg NUMERIC(12,2),
  recurrence_pattern TEXT CHECK (recurrence_pattern IN ('weekly','bi-weekly','28-day','monthly','quarterly','annual','irregular','one-off')),
  recurrence_confidence NUMERIC(4,3) DEFAULT 0,
  first_seen_date DATE,
  last_seen_date DATE,
  appearance_count INTEGER DEFAULT 1,
  months_seen TEXT[] DEFAULT '{}',
  linked_property TEXT,
  linked_person TEXT,
  is_business BOOLEAN,
  is_suspicious BOOLEAN DEFAULT false,
  is_personal BOOLEAN DEFAULT false,
  needs_review BOOLEAN DEFAULT false,
  include_in_forecast BOOLEAN DEFAULT true,
  ai_explanation TEXT,
  confidence NUMERIC(4,3) DEFAULT 0.5,
  source TEXT DEFAULT 'ai' CHECK (source IN ('ai', 'user', 'system', 'keyword')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, canonical_name)
);

-- Annotations: user-driven corrections, flags, and notes on transactions
CREATE TABLE IF NOT EXISTS transaction_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  transaction_description TEXT NOT NULL,
  transaction_date DATE,
  transaction_amount NUMERIC(12,2),
  merchant_normalized TEXT,
  original_subcategory TEXT,
  corrected_subcategory TEXT,
  flag_type TEXT CHECK (flag_type IN ('personal','suspicious','business','needs_review','exclude_from_forecast')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Forecast accuracy tracking: measure how well predictions matched reality
CREATE TABLE IF NOT EXISTS forecast_accuracy_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  forecast_month TEXT NOT NULL,
  predicted_month_end NUMERIC(12,2),
  actual_month_end NUMERIC(12,2),
  predicted_income NUMERIC(12,2),
  actual_income NUMERIC(12,2),
  predicted_expenses NUMERIC(12,2),
  actual_expenses NUMERIC(12,2),
  predicted_lowest NUMERIC(12,2),
  actual_lowest NUMERIC(12,2),
  confidence_at_time NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, forecast_month)
);

-- Enable RLS
ALTER TABLE statement_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_intel ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_accuracy_log ENABLE ROW LEVEL SECURITY;

-- Statement history policies
CREATE POLICY "Company members read statement_history" ON statement_history
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Company members insert statement_history" ON statement_history
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );

-- Vendor intel policies
CREATE POLICY "Company members read vendor_intel" ON vendor_intel
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Company members insert vendor_intel" ON vendor_intel
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Company members update vendor_intel" ON vendor_intel
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );

-- Annotations policies
CREATE POLICY "Company members read annotations" ON transaction_annotations
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Company members insert annotations" ON transaction_annotations
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Company members update annotations" ON transaction_annotations
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );

-- Forecast accuracy policies
CREATE POLICY "Company members read forecast_accuracy" ON forecast_accuracy_log
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Company members insert forecast_accuracy" ON forecast_accuracy_log
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_statement_history_company ON statement_history(company_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_intel_company ON vendor_intel(company_id, canonical_name);
CREATE INDEX IF NOT EXISTS idx_vendor_intel_subcategory ON vendor_intel(company_id, subcategory);
CREATE INDEX IF NOT EXISTS idx_annotations_company ON transaction_annotations(company_id, merchant_normalized);
CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_company ON forecast_accuracy_log(company_id, forecast_month);
