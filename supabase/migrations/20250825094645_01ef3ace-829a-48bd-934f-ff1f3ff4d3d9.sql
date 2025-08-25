-- Create help_content table for managing help text
CREATE TABLE public.help_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.help_content ENABLE ROW LEVEL SECURITY;

-- Create policies - everyone can read, only system admins can write
CREATE POLICY "Help content is viewable by authenticated users" 
ON public.help_content 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Only system admins can insert help content" 
ON public.help_content 
FOR INSERT 
TO authenticated
WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Only system admins can update help content" 
ON public.help_content 
FOR UPDATE 
TO authenticated
USING (is_system_admin(auth.uid()));

CREATE POLICY "Only system admins can delete help content" 
ON public.help_content 
FOR DELETE 
TO authenticated
USING (is_system_admin(auth.uid()));

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_help_content_updated_at
BEFORE UPDATE ON public.help_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default help content
INSERT INTO public.help_content (title, content, section) VALUES 
('Allgemeine Hilfe', 'Hier finden Sie Hilfe und Anleitungen zur Nutzung der Turnierverwaltung.

## Schnellstart

1. **Turnier erstellen**: Gehen Sie zur Turnier-Seite und klicken Sie auf "Neues Turnier"
2. **Turniereinstellungen**: Konfigurieren Sie Format, Tableau-Größe und andere Einstellungen
3. **Anmeldungen verwalten**: Überwachen Sie Anmeldungen und passen Sie bei Bedarf die Tableau-Größe an
4. **Bracket erstellen**: Generieren Sie das Turnier-Bracket und weisen Sie Teilnehmer zu
5. **Turnier durchführen**: Setzen Sie Ergebnisse und verfolgen Sie den Turnierfortschritt

## Weitere Hilfe

Für weitere Unterstützung wenden Sie sich an Ihren Administrator.', 'general');