-- Step 1: Add system_admin role and create system-level roles table
CREATE TYPE public.system_role AS ENUM ('system_admin');

-- Create system_roles table for system-wide administrators
CREATE TABLE public.system_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  role system_role NOT NULL DEFAULT 'system_admin',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on system_roles
ALTER TABLE public.system_roles ENABLE ROW LEVEL SECURITY;

-- Add 'manager' role to tenant_role enum
ALTER TYPE public.tenant_role ADD VALUE 'manager';

-- Create functions for system admin checks
CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.system_roles
    WHERE user_id = _user_id
      AND role = 'system_admin'
  );
$$;

-- Update has_role function to work with system admins
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT 
    CASE 
      WHEN _role = 'admin' THEN is_system_admin(_user_id)
      ELSE false
    END;
$$;

-- RLS Policies for system_roles
CREATE POLICY "System admins can view system roles" 
ON public.system_roles 
FOR SELECT 
USING (is_system_admin(auth.uid()));

CREATE POLICY "System admins can manage system roles" 
ON public.system_roles 
FOR ALL 
USING (is_system_admin(auth.uid()));

-- Update tenants policies to allow system admins full access
DROP POLICY IF EXISTS "Super admins can manage all tenants" ON public.tenants;

CREATE POLICY "System admins can manage all tenants" 
ON public.tenants 
FOR ALL 
USING (is_system_admin(auth.uid()));

CREATE POLICY "System admins can create tenants" 
ON public.tenants 
FOR INSERT 
WITH CHECK (is_system_admin(auth.uid()));

-- Update user_roles policies for system admins
CREATE POLICY "System admins can manage all user roles" 
ON public.user_roles 
FOR ALL 
USING (is_system_admin(auth.uid()));

-- Update tournaments policies for system admins
CREATE POLICY "System admins can view all tournaments" 
ON public.tournaments 
FOR SELECT 
USING (is_system_admin(auth.uid()));

-- Update players policies for system admins  
CREATE POLICY "System admins can view all players" 
ON public.players 
FOR SELECT 
USING (is_system_admin(auth.uid()));

-- Function to get user's system role
CREATE OR REPLACE FUNCTION public.get_current_user_system_role()
RETURNS system_role
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT role 
  FROM public.system_roles 
  WHERE user_id = auth.uid() 
  LIMIT 1;
$$;