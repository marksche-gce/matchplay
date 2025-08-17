-- Create or replace has_role function to check roles via SECURITY DEFINER
create or replace function public.has_role(_user_id uuid, _role text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.role = _role::text
  );
$$;

-- Ensure authenticated users can execute this function
grant execute on function public.has_role(uuid, text) to authenticated;