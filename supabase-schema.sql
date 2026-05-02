-- Supabase schema for Bank Statement Reader (Rise-Up-AI)
-- Run this in the Supabase SQL Editor at:
-- https://supabase.com/dashboard/project/nmdbngcwmrgqtpzukwkf/sql

-- Documents table: stores uploaded statements + their AI insights
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  mode TEXT NOT NULL CHECK (mode IN ('personal', 'business')),
  statement_data JSONB NOT NULL,
  insights JSONB
);

-- Index for sorting by upload date
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents (uploaded_at DESC);

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Public access policy (no auth yet — full public access for MVP)
-- REPLACE THIS with user-scoped policies when auth is added.
CREATE POLICY "Public read access" ON documents
  FOR SELECT USING (true);

CREATE POLICY "Public insert access" ON documents
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update access" ON documents
  FOR UPDATE USING (true);
