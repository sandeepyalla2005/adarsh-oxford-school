-- Add 'dropout_pending' to the student_status enum type
-- Note: In Postgres, ALTER TYPE ... ADD VALUE cannot be executed inside a transaction block in some versions/scenarios.
-- However, Supabase migrations handle this.
ALTER TYPE student_status ADD VALUE IF NOT EXISTS 'dropout_pending';
