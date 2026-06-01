-- Migration to adjust course_payments check constraint to support Term 0 (Old Outstanding Dues)

ALTER TABLE course_payments DROP CONSTRAINT IF EXISTS course_payments_term_check;
ALTER TABLE course_payments ADD CONSTRAINT course_payments_term_check CHECK (term IN (0, 1, 2, 3));
