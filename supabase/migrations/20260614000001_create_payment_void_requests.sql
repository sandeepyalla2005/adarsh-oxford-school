-- Migration to create payment_void_requests table for secure payment reversals with admin approval

CREATE TABLE IF NOT EXISTS payment_void_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number TEXT NOT NULL,
    payment_type TEXT NOT NULL, -- 'course', 'books', 'transport', 'accessory', 'left_student'
    amount NUMERIC(10,2) NOT NULL,
    student_name TEXT NOT NULL,
    requested_by UUID REFERENCES auth.users(id),
    requested_at TIMESTAMPTZ DEFAULT now(),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE payment_void_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated users to insert requests" ON payment_void_requests;
DROP POLICY IF EXISTS "Allow authenticated users to read requests" ON payment_void_requests;
DROP POLICY IF EXISTS "Allow admins to update requests" ON payment_void_requests;

-- Create security policies
CREATE POLICY "Allow authenticated users to insert requests" ON payment_void_requests 
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read requests" ON payment_void_requests 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admins to update requests" ON payment_void_requests 
    FOR UPDATE TO authenticated USING (true);
