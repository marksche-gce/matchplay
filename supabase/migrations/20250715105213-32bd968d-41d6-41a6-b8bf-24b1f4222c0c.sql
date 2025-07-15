-- Add bracket relationship columns to matches table
ALTER TABLE public.matches 
ADD COLUMN next_match_id UUID REFERENCES public.matches(id),
ADD COLUMN previous_match_1_id UUID REFERENCES public.matches(id),
ADD COLUMN previous_match_2_id UUID REFERENCES public.matches(id);

-- Add indexes for better performance on relationship lookups
CREATE INDEX IF NOT EXISTS idx_matches_next_match_id ON public.matches(next_match_id);
CREATE INDEX IF NOT EXISTS idx_matches_previous_match_1_id ON public.matches(previous_match_1_id);
CREATE INDEX IF NOT EXISTS idx_matches_previous_match_2_id ON public.matches(previous_match_2_id);