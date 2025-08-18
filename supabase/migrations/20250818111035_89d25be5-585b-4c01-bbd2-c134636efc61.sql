-- Allow system admins to manage tournaments_new (close/open registration, edit, delete)
create policy "System admins can manage tournaments"
on public.tournaments_new
for all
using (is_system_admin(auth.uid()))
with check (is_system_admin(auth.uid()));