-- Create user roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'organizer', 'player');

-- Create user roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'player',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles safely
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role 
  FROM public.user_roles 
  WHERE user_id = auth.uid() 
  ORDER BY 
    CASE role 
      WHEN 'admin' THEN 1 
      WHEN 'organizer' THEN 2 
      WHEN 'player' THEN 3 
    END 
  LIMIT 1
$$;

-- Create profiles table for user data
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create trigger function to create profile and assign default role on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  
  -- Assign default player role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'player');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update RLS policies for existing tables

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Players can view all players" ON public.players;
DROP POLICY IF EXISTS "Users can insert their own player profile" ON public.players;
DROP POLICY IF EXISTS "Users can update their own player profile" ON public.players;

DROP POLICY IF EXISTS "Anyone can view tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Authenticated users can insert tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Authenticated users can update tournaments" ON public.tournaments;

DROP POLICY IF EXISTS "Anyone can view registrations" ON public.tournament_registrations;
DROP POLICY IF EXISTS "Authenticated users can register" ON public.tournament_registrations;
DROP POLICY IF EXISTS "Users can update their own registrations" ON public.tournament_registrations;

DROP POLICY IF EXISTS "Anyone can view matches" ON public.matches;
DROP POLICY IF EXISTS "Authenticated users can create matches" ON public.matches;
DROP POLICY IF EXISTS "Authenticated users can update matches" ON public.matches;

DROP POLICY IF EXISTS "Anyone can view match participants" ON public.match_participants;
DROP POLICY IF EXISTS "Authenticated users can manage participants" ON public.match_participants;
DROP POLICY IF EXISTS "Authenticated users can update participants" ON public.match_participants;

-- Create secure RLS policies for players table
CREATE POLICY "Users can view tournament-relevant player data" 
ON public.players FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own player profile" 
ON public.players FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own player profile" 
ON public.players FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

-- Create secure RLS policies for tournaments table
CREATE POLICY "Anyone can view active tournaments" 
ON public.tournaments FOR SELECT 
USING (status = 'active' OR status = 'upcoming');

CREATE POLICY "Admins and organizers can view all tournaments" 
ON public.tournaments FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizer'));

CREATE POLICY "Admins and organizers can create tournaments" 
ON public.tournaments FOR INSERT 
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizer'));

CREATE POLICY "Admins and organizers can update tournaments" 
ON public.tournaments FOR UPDATE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizer'));

-- Create secure RLS policies for registrations table
CREATE POLICY "Users can view their own registrations" 
ON public.tournament_registrations FOR SELECT 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.players 
  WHERE players.id = tournament_registrations.player_id 
  AND players.user_id = auth.uid()
));

CREATE POLICY "Organizers can view registrations for their tournaments" 
ON public.tournament_registrations FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizer'));

CREATE POLICY "Authenticated users can register for tournaments" 
ON public.tournament_registrations FOR INSERT 
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.players 
  WHERE players.id = tournament_registrations.player_id 
  AND players.user_id = auth.uid()
));

CREATE POLICY "Users can update their own registrations" 
ON public.tournament_registrations FOR UPDATE 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.players 
  WHERE players.id = tournament_registrations.player_id 
  AND players.user_id = auth.uid()
));

-- Create secure RLS policies for matches table
CREATE POLICY "Users can view matches for tournaments they're registered in" 
ON public.matches FOR SELECT 
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'organizer')
  OR EXISTS (
    SELECT 1 FROM public.tournament_registrations tr
    JOIN public.players p ON tr.player_id = p.id
    WHERE tr.tournament_id = matches.tournament_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Organizers can create matches" 
ON public.matches FOR INSERT 
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizer'));

CREATE POLICY "Organizers can update matches" 
ON public.matches FOR UPDATE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizer'));

-- Create secure RLS policies for match participants table
CREATE POLICY "Users can view match participants for matches they can see" 
ON public.match_participants FOR SELECT 
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'organizer')
  OR EXISTS (
    SELECT 1 FROM public.matches m
    JOIN public.tournament_registrations tr ON tr.tournament_id = m.tournament_id
    JOIN public.players p ON tr.player_id = p.id
    WHERE m.id = match_participants.match_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Organizers can manage match participants" 
ON public.match_participants FOR INSERT 
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizer'));

CREATE POLICY "Organizers can update match participants" 
ON public.match_participants FOR UPDATE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizer'));

-- Create RLS policies for profiles table
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
TO authenticated
USING (auth.uid() = id);

-- Create RLS policies for user_roles table
CREATE POLICY "Users can view their own roles" 
ON public.user_roles FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" 
ON public.user_roles FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can assign roles" 
ON public.user_roles FOR INSERT 
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles" 
ON public.user_roles FOR UPDATE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();