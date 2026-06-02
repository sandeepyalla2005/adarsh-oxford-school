-- Migration: Create QR Fee Payments Module
-- Date: 2026-05-31

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

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_qr_fee_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
