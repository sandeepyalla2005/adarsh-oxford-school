-- Migration: Create Left Students Module
-- Date: 2026-05-22

-- 1. Add new statuses to student_status ENUM
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'student_status' AND e.enumlabel = 'tc_issued') THEN
        ALTER TYPE student_status ADD VALUE 'tc_issued';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'student_status' AND e.enumlabel = 'completed_10th') THEN
        ALTER TYPE student_status ADD VALUE 'completed_10th';
    END IF;
END
$$;

-- 2. Create left_student_fee_records table
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

-- 3. Create left_student_recovery_payments table
CREATE TABLE IF NOT EXISTS left_student_recovery_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    left_record_id UUID NOT NULL REFERENCES left_student_fee_records(id) ON DELETE CASCADE,
    amount_paid NUMERIC(10, 2) NOT NULL,
    payment_method TEXT NOT NULL, -- CASH, UPI, BANK_TRANSFER, CHEQUE
    receipt_number TEXT NOT NULL,
    remarks TEXT,
    payment_date TIMESTAMPTZ DEFAULT NOW(),
    collected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Triggers for updated_at
CREATE OR REPLACE FUNCTION update_left_student_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_left_student_updated_at
BEFORE UPDATE ON left_student_fee_records
FOR EACH ROW
EXECUTE FUNCTION update_left_student_updated_at();

-- 5. RLS Policies
ALTER TABLE left_student_fee_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE left_student_recovery_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read left_student_fee_records"
    ON left_student_fee_records FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to modify left_student_fee_records"
    ON left_student_fee_records FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read left_student_recovery_payments"
    ON left_student_recovery_payments FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to modify left_student_recovery_payments"
    ON left_student_recovery_payments FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
