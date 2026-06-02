-- Migration: Enhance QR Payments and Leaving Students Module
-- Date: 2026-06-02

-- 1. Create left_student_fee_records table if not exists (in case it wasn't run)
CREATE TABLE IF NOT EXISTS left_student_fee_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    leaving_status TEXT NOT NULL,
    leaving_date TIMESTAMPTZ DEFAULT NOW(),
    leaving_reason TEXT,
    pending_term_fee NUMERIC(10, 2) DEFAULT 0.0,
    pending_transport_fee NUMERIC(10, 2) DEFAULT 0.0,
    pending_books_fee NUMERIC(10, 2) DEFAULT 0.0,
    old_due NUMERIC(10, 2) DEFAULT 0.0,
    total_pending_amount NUMERIC(10, 2) DEFAULT 0.0,
    recovery_status TEXT NOT NULL DEFAULT 'UNPAID', -- UNPAID, PARTIALLY_PAID, FULLY_PAID, WAIVED
    recovered_amount NUMERIC(10, 2) DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create qr_fee_payments table if not exists (in case it wasn't run)
CREATE TABLE IF NOT EXISTS qr_fee_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_name TEXT NOT NULL,
    admission_number TEXT NOT NULL,
    class_name TEXT NOT NULL,
    parent_name TEXT,
    mobile_number TEXT,
    amount NUMERIC(10, 2) NOT NULL,
    screenshot_url TEXT,
    status TEXT NOT NULL DEFAULT 'Awaiting Verification', -- 'Awaiting Verification', 'Approved', 'Rejected'
    receipt_number TEXT,
    preferred_qr TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure qr_fee_payments RLS policies exist
ALTER TABLE qr_fee_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'qr_fee_payments' AND policyname = 'Allow public to insert qr_fee_payments') THEN
        CREATE POLICY "Allow public to insert qr_fee_payments" ON qr_fee_payments FOR INSERT TO public WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'qr_fee_payments' AND policyname = 'Allow public to read qr_fee_payments') THEN
        CREATE POLICY "Allow public to read qr_fee_payments" ON qr_fee_payments FOR SELECT TO public USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'qr_fee_payments' AND policyname = 'Allow authenticated to manage qr_fee_payments') THEN
        CREATE POLICY "Allow authenticated to manage qr_fee_payments" ON qr_fee_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 3. Add allocation and left_record_id columns to qr_fee_payments
ALTER TABLE qr_fee_payments ADD COLUMN IF NOT EXISTS allocation JSONB;
ALTER TABLE qr_fee_payments ADD COLUMN IF NOT EXISTS left_record_id UUID REFERENCES left_student_fee_records(id) ON DELETE SET NULL;

-- 4. Add columns to students table for fine and miscellaneous charges
ALTER TABLE students ADD COLUMN IF NOT EXISTS fine_amount NUMERIC(10, 2) DEFAULT 0.0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS misc_charges NUMERIC(10, 2) DEFAULT 0.0;

-- 5. Create fine_payments and misc_payments tables
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

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fine_payments' AND policyname = 'Allow public to insert fine_payments') THEN
        CREATE POLICY "Allow public to insert fine_payments" ON fine_payments FOR INSERT TO public WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fine_payments' AND policyname = 'Allow public to read fine_payments') THEN
        CREATE POLICY "Allow public to read fine_payments" ON fine_payments FOR SELECT TO public USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fine_payments' AND policyname = 'Allow authenticated to manage fine_payments') THEN
        CREATE POLICY "Allow authenticated to manage fine_payments" ON fine_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'misc_payments' AND policyname = 'Allow public to insert misc_payments') THEN
        CREATE POLICY "Allow public to insert misc_payments" ON misc_payments FOR INSERT TO public WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'misc_payments' AND policyname = 'Allow public to read misc_payments') THEN
        CREATE POLICY "Allow public to read misc_payments" ON misc_payments FOR SELECT TO public USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'misc_payments' AND policyname = 'Allow authenticated to manage misc_payments') THEN
        CREATE POLICY "Allow authenticated to manage misc_payments" ON misc_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 6. Alter left_student_fee_records to add new columns for fine/accessories/misc dues and TC/Marksheet details
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
