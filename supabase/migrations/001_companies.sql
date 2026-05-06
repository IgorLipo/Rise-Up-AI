-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  owner_id UUID NOT NULL REFERENCES auth.users(id)
);

-- Junction table
CREATE TABLE IF NOT EXISTS company_members (
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  PRIMARY KEY (company_id, user_id)
);

-- Alter documents for multi-tenancy
ALTER TABLE documents ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id);

-- New RLS policies (drop old public ones first)
DROP POLICY IF EXISTS "Public read access" ON documents;
DROP POLICY IF EXISTS "Public insert access" ON documents;
DROP POLICY IF EXISTS "Public update access" ON documents;

CREATE POLICY "Company members read" ON documents
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Company members insert" ON documents
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Company members update" ON documents
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );

-- RLS for companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read companies" ON companies
  FOR SELECT USING (
    id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Owners insert companies" ON companies
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- RLS for company_members
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read memberships" ON company_members
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Owners manage memberships" ON company_members
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );
