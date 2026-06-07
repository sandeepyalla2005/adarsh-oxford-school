-- ====================================================================
-- UNIFIED SQL MIGRATION FILE FOR MISSING SCHEMAS
-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard)
-- ====================================================================

-- 1. Create student_status enum additions if they do not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'student_status' AND e.enumlabel = 'dropout_pending') THEN
        BEGIN
            ALTER TYPE student_status ADD VALUE 'dropout_pending';
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'student_status' AND e.enumlabel = 'graduated') THEN
        BEGIN
            ALTER TYPE student_status ADD VALUE 'graduated';
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END;
    END IF;
END
$$;

-- 2. Create qr_fee_payments table if it doesn't exist
CREATE TABLE IF NOT EXISTS qr_fee_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_name TEXT NOT NULL,
    admission_number TEXT NOT NULL,
    class_name TEXT NOT NULL,
    parent_name TEXT,
    mobile_number TEXT,
    amount NUMERIC(10, 2) NOT NULL,
    screenshot_url TEXT, -- Base64 or uploaded URL
    status TEXT NOT NULL DEFAULT 'Awaiting Verification', -- 'Awaiting Verification', 'Approved', 'Rejected'
    receipt_number TEXT, -- Auto-generated when approved
    preferred_qr TEXT, -- 'PhonePe' or 'ICICI Bank'
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Triggers for updated_at on qr_fee_payments
CREATE OR REPLACE FUNCTION update_qr_fee_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_qr_fee_payments_updated_at ON qr_fee_payments;
CREATE TRIGGER trigger_update_qr_fee_payments_updated_at
BEFORE UPDATE ON qr_fee_payments
FOR EACH ROW
EXECUTE FUNCTION update_qr_fee_payments_updated_at();

-- Enable Row Level Security
ALTER TABLE qr_fee_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public to insert qr_fee_payments" ON qr_fee_payments;
DROP POLICY IF EXISTS "Allow public to read qr_fee_payments" ON qr_fee_payments;
DROP POLICY IF EXISTS "Allow authenticated to manage qr_fee_payments" ON qr_fee_payments;

-- Create RLS Policies
CREATE POLICY "Allow public to insert qr_fee_payments"
    ON qr_fee_payments FOR INSERT
    TO public
    WITH CHECK (true);

CREATE POLICY "Allow public to read qr_fee_payments"
    ON qr_fee_payments FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Allow authenticated to manage qr_fee_payments"
    ON qr_fee_payments FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 3. Adjust course_payments check constraint
ALTER TABLE course_payments DROP CONSTRAINT IF EXISTS course_payments_term_check;
ALTER TABLE course_payments ADD CONSTRAINT course_payments_term_check CHECK (term IN (0, 1, 2, 3));

-- 4. Drop receipt number unique constraints
ALTER TABLE course_payments DROP CONSTRAINT IF EXISTS course_payments_receipt_number_key;
ALTER TABLE books_payments DROP CONSTRAINT IF EXISTS books_payments_receipt_number_key;
ALTER TABLE transport_payments DROP CONSTRAINT IF EXISTS transport_payments_receipt_number_key;

-- 5. Alter qr_fee_payments to add allocation and left_record_id
ALTER TABLE qr_fee_payments ADD COLUMN IF NOT EXISTS allocation JSONB;
ALTER TABLE qr_fee_payments ADD COLUMN IF NOT EXISTS left_record_id UUID REFERENCES left_student_fee_records(id) ON DELETE SET NULL;

-- 6. Add columns to students table for fine and miscellaneous charges
ALTER TABLE students ADD COLUMN IF NOT EXISTS fine_amount NUMERIC(10, 2) DEFAULT 0.0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS misc_charges NUMERIC(10, 2) DEFAULT 0.0;

-- 7. Create fine_payments and misc_payments tables
CREATE TABLE IF NOT EXISTS fine_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL,
    amount_paid NUMERIC(10, 2) NOT NULL,
    payment_method TEXT NOT NULL,
    receipt_number TEXT NOT NULL,
    collected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS misc_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL,
    amount_paid NUMERIC(10, 2) NOT NULL,
    payment_method TEXT NOT NULL,
    receipt_number TEXT NOT NULL,
    collected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for payments tables
ALTER TABLE fine_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE misc_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public to insert fine_payments" ON fine_payments;
DROP POLICY IF EXISTS "Allow public to read fine_payments" ON fine_payments;
DROP POLICY IF EXISTS "Allow authenticated to manage fine_payments" ON fine_payments;

DROP POLICY IF EXISTS "Allow public to insert misc_payments" ON misc_payments;
DROP POLICY IF EXISTS "Allow public to read misc_payments" ON misc_payments;
DROP POLICY IF EXISTS "Allow authenticated to manage misc_payments" ON misc_payments;

-- Create policies for payments tables
CREATE POLICY "Allow public to insert fine_payments" ON fine_payments FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public to read fine_payments" ON fine_payments FOR SELECT TO public USING (true);
CREATE POLICY "Allow authenticated to manage fine_payments" ON fine_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow public to insert misc_payments" ON misc_payments FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public to read misc_payments" ON misc_payments FOR SELECT TO public USING (true);
CREATE POLICY "Allow authenticated to manage misc_payments" ON misc_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Alter left_student_fee_records to add new columns
ALTER TABLE left_student_fee_records ADD COLUMN IF NOT EXISTS pending_accessories_fee NUMERIC(10, 2) DEFAULT 0.0;
ALTER TABLE left_student_fee_records ADD COLUMN IF NOT EXISTS pending_fine_fee NUMERIC(10, 2) DEFAULT 0.0;
ALTER TABLE left_student_fee_records ADD COLUMN IF NOT EXISTS pending_misc_fee NUMERIC(10, 2) DEFAULT 0.0;

ALTER TABLE left_student_fee_records ADD COLUMN IF NOT EXISTS tc_status TEXT DEFAULT 'Pending'; -- 'Pending', 'Approved', 'Issued', 'Cancelled'
ALTER TABLE left_student_fee_records ADD COLUMN IF NOT EXISTS tc_requested_date TIMESTAMPTZ;
ALTER TABLE left_student_fee_records ADD COLUMN IF NOT EXISTS tc_issued_date TIMESTAMPTZ;
ALTER TABLE left_student_fee_records ADD COLUMN IF NOT EXISTS tc_issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE left_student_fee_records ADD COLUMN IF NOT EXISTS tc_number TEXT;
ALTER TABLE left_student_fee_records ADD COLUMN IF NOT EXISTS tc_remarks TEXT;

ALTER TABLE left_student_fee_records ADD COLUMN IF NOT EXISTS marksheet_status TEXT DEFAULT 'Pending'; -- 'Pending', 'Generated', 'Printed', 'Issued'
ALTER TABLE left_student_fee_records ADD COLUMN IF NOT EXISTS marksheet_issued_date TIMESTAMPTZ;
ALTER TABLE left_student_fee_records ADD COLUMN IF NOT EXISTS marksheet_issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE left_student_fee_records ADD COLUMN IF NOT EXISTS marksheet_remarks TEXT;
