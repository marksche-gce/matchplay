-- Update the header image URL to use the new filename
UPDATE public.app_settings 
SET setting_value = 'https://matchplay.ch/images/headerbildneu.jpg',
    updated_at = now()
WHERE setting_key = 'header_image_url';