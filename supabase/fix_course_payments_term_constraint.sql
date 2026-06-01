-- Run this in the Supabase SQL Editor to allow Old Outstanding Dues (term 0) in course_payments table

ALTER TABLE course_payments DROP CONSTRAINT IF EXISTS course_payments_term_check;
ALTER TABLE course_payments ADD CONSTRAINT course_payments_term_check CHECK (term IN (0, 1, 2, 3));
