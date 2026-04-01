do $$
begin
  if not exists (select 1 from auth.users limit 1) then
    raise exception 'auth.users is not accessible in this environment';
  end if;
end
$$;

create or replace function public.bootstrap_admin_staff_profile(p_user_id uuid, p_email text, p_name text)
returns void
language plpgsql
as $$
begin
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'Auth user % not found. Create the user in Supabase Auth first.', p_user_id;
  end if;

  insert into public.staff_profiles (user_id, email, name, role, must_change_password, created_by_user_id)
  values (p_user_id, p_email, p_name, 'admin', false, p_user_id)
  on conflict (user_id) do update
  set email = excluded.email,
      name = excluded.name,
      role = 'admin',
      must_change_password = false;
end
$$;
