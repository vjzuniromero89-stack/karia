-- Run AFTER creating your first user in KARIA/Supabase Auth.
-- Replace the email below with the email that should be Super Admin.
update public.profiles p set role='super_admin'
from auth.users u where p.id=u.id and u.email='YOUR-ADMIN-EMAIL-HERE';
