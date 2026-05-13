CREATE TABLE IF NOT EXISTS company_aggregate_cache (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  aggregate_data JSONB NOT NULL,
  data_version INTEGER DEFAULT 1,
  last_calculated_at TIMESTAMPTZ DEFAULT now(),
  needs_recalculation BOOLEAN DEFAULT false
);

ALTER TABLE company_aggregate_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members read cache" ON company_aggregate_cache
  FOR SELECT USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));
CREATE POLICY "Company members insert cache" ON company_aggregate_cache
  FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));
CREATE POLICY "Company members update cache" ON company_aggregate_cache
  FOR UPDATE USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));
