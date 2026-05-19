-- 1. Create the academic_calendars table
CREATE TABLE IF NOT EXISTS public.academic_calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size TEXT,
    file_type TEXT,
    academic_year TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT unique_class_academic_year UNIQUE (class_name, academic_year)
);

-- 2. Enable RLS on academic_calendars table
ALTER TABLE public.academic_calendars ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Allow public read access to academic calendars
CREATE POLICY "Allow public read access to academic calendars" ON public.academic_calendars
    FOR SELECT USING (true);

-- 4. Policy: Allow authenticated users full access to academic calendars
CREATE POLICY "Allow authenticated users full access to academic calendars" ON public.academic_calendars
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Storage Policies for the 'academic-calendars' bucket:
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload calendars" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'academic-calendars');

-- Allow authenticated users to update/overwrite files
CREATE POLICY "Allow authenticated users to update calendars" ON storage.objects
    FOR UPDATE TO authenticated WITH CHECK (bucket_id = 'academic-calendars');

-- Allow public read access to calendars
CREATE POLICY "Allow public to view calendars" ON storage.objects
    FOR SELECT USING (bucket_id = 'academic-calendars');

-- Allow authenticated users to delete calendars
CREATE POLICY "Allow authenticated users to delete calendars" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'academic-calendars');
