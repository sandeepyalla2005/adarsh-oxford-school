-- Migration to drop the unique constraints on receipt_number across course_payments, books_payments, and transport_payments
-- This enables consolidating multiple term payments (Course Fees) or month payments (Transport Fees) under a single receipt number.

ALTER TABLE course_payments DROP CONSTRAINT IF EXISTS course_payments_receipt_number_key;
ALTER TABLE books_payments DROP CONSTRAINT IF EXISTS books_payments_receipt_number_key;
ALTER TABLE transport_payments DROP CONSTRAINT IF EXISTS transport_payments_receipt_number_key;
