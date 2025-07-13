-- Change handicap column from integer to decimal to allow decimal places
ALTER TABLE public.players 
ALTER COLUMN handicap TYPE NUMERIC(4,1) USING handicap::NUMERIC(4,1);