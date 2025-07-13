-- Remove the unique constraint on email column to allow duplicate or null emails
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_email_key;