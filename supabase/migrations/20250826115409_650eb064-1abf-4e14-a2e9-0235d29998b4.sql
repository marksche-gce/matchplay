-- Create content management table for onepager
CREATE TABLE public.onepager_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section TEXT NOT NULL,
  title TEXT,
  content TEXT,
  image_url TEXT,
  order_position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.onepager_content ENABLE ROW LEVEL SECURITY;

-- Create policies for onepager content
CREATE POLICY "Everyone can view onepager content"
ON public.onepager_content
FOR SELECT
USING (true);

CREATE POLICY "Only system admins can manage onepager content"
ON public.onepager_content
FOR ALL
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- Insert default content
INSERT INTO public.onepager_content (section, title, content, image_url, order_position) VALUES
('hero', 'Willkommen zum Golf Tournament Manager', 'Die ultimative Lösung für die Verwaltung von Matchplay Golf-Turnieren. Einfach, effizient und professionell.', null, 1),
('feature', 'Professionelle Turnierverwaltung', 'Verwalten Sie Ihre Golf-Turniere mit unserem benutzerfreundlichen System. Von der Anmeldung bis zur Ergebnisermittlung - alles an einem Ort.', '/src/assets/golf-hero.jpg', 2),
('contact', 'Kontakt', 'Haben Sie Fragen? Kontaktieren Sie uns unter info@golf-tournament.de oder telefonisch unter +49 123 456789.', null, 3);