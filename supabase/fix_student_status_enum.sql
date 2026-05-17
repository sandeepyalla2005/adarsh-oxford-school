-- SQL to fix the student_status enum error
-- Run this in the Supabase SQL Editor

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'student_status' AND e.enumlabel = 'dropout_pending') THEN
        ALTER TYPE student_status ADD VALUE 'dropout_pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'student_status' AND e.enumlabel = 'graduated') THEN
        ALTER TYPE student_status ADD VALUE 'graduated';
    END IF;
END
$$;
