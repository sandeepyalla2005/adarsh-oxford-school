-- Run this in the Supabase SQL Editor to drop the unique constraints on receipt_number across all three payment tables.
-- This allows collecting payments for multiple terms (Course Fees) or multiple months (Transport Fees) under a single receipt transaction.

ALTER TABLE course_payments DROP CONSTRAINT IF EXISTS course_payments_receipt_number_key;
ALTER TABLE books_payments DROP CONSTRAINT IF EXISTS books_payments_receipt_number_key;
ALTER TABLE transport_payments DROP CONSTRAINT IF EXISTS transport_payments_receipt_number_key;
