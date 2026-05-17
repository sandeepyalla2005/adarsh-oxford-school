
-- Create wipe_requests table for persistent OTP storage
CREATE TABLE IF NOT EXISTS public.wipe_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    operation_type TEXT NOT NULL DEFAULT 'students', -- 'students' or 'staff'
    otp_hash TEXT NOT NULL,
    otp_salt TEXT NOT NULL,
    plain_otp TEXT, -- Stored temporarily for dashboard display
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wipe_requests ENABLE ROW LEVEL SECURITY;

-- Allow only service_role to access this table
CREATE POLICY "Service role only" ON public.wipe_requests
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_wipe_requests_user_id ON public.wipe_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_wipe_requests_expires_at ON public.wipe_requests(expires_at);
