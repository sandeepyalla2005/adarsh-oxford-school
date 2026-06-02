-- Migration: Update Left Students RLS Policies
-- Date: 2026-05-24

-- Drop overly permissive write policies
DROP POLICY IF EXISTS "Allow authenticated users to modify left_student_fee_records" ON left_student_fee_records;
DROP POLICY IF EXISTS "Allow authenticated users to modify left_student_recovery_payments" ON left_student_recovery_payments;

-- Re-establish secure SELECT-only policies for authenticated users
CREATE POLICY "Allow select for authenticated" 
    ON left_student_fee_records FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow select for authenticated recovery" 
    ON left_student_recovery_payments FOR SELECT 
    TO authenticated 
    USING (true);

-- Ensure all database writes (INSERTS, UPDATES, DELETES) are locked down
-- only service_role (used by our backend) can perform them
CREATE POLICY "Admin/Service role only modification on left_student_fee_records"
    ON left_student_fee_records FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Admin/Service role only modification on left_student_recovery_payments"
    ON left_student_recovery_payments FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
