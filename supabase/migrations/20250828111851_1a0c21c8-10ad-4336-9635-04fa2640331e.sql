-- Add video_url column to onepager_content table
ALTER TABLE public.onepager_content ADD COLUMN video_url TEXT;

-- Add video_url column to site_settings table for header video support
ALTER TABLE public.site_settings ADD COLUMN video_url TEXT;