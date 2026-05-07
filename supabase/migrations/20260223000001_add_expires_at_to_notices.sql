-- Add expires_at column to notices table
alter table public.notices add column if not exists expires_at timestamptz;

-- Update RLS policy to only show non-expired notices
-- We use a view or update the existing policy if possible, 
-- but actually just adding the condition to the select query in the frontend is easier 
-- since we already have select policies.

-- However, to be strict, we can update the policy:
drop policy if exists "Staff and admin can view notices" on public.notices;
create policy "Staff and admin can view notices"
  on public.notices
  for select
  using (
    public.is_staff_or_admin() AND 
    (expires_at IS NULL OR expires_at > now())
  );
