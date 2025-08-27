-- Set the header image to use the external URL
INSERT INTO public.app_settings (setting_key, setting_value)
VALUES ('header_image_url', 'https://matchplay.ch/images/header.jpg')
ON CONFLICT (setting_key) 
DO UPDATE SET 
  setting_value = 'https://matchplay.ch/images/header.jpg',
  updated_at = now();