-- Create storage bucket for header images
INSERT INTO storage.buckets (id, name, public) VALUES ('header-images', 'header-images', true);

-- Create policies for header images
CREATE POLICY "Anyone can view header images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'header-images');

CREATE POLICY "Admins and organizers can upload header images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'header-images' 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role))
);

CREATE POLICY "Admins and organizers can update header images" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'header-images' 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role))
);

CREATE POLICY "Admins and organizers can delete header images" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'header-images' 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role))
);

-- Create settings table to store current header image
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for app_settings
CREATE POLICY "Anyone can view app settings" 
ON public.app_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Admins and organizers can manage app settings" 
ON public.app_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role));

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default header image setting
INSERT INTO public.app_settings (setting_key, setting_value) 
VALUES ('header_image_url', '/src/assets/golf-hero.jpg');