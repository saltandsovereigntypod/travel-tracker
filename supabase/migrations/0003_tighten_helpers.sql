-- Membership helper functions are only for RLS policies of signed-in users.
-- Postgres grants EXECUTE to PUBLIC by default, so remove anon access.
revoke execute on function public.is_trip_member(uuid) from public, anon;
revoke execute on function public.can_edit_trip(uuid) from public, anon;
revoke execute on function public.is_trip_owner(uuid) from public, anon;
revoke execute on function public.shares_trip_with(uuid) from public, anon;
revoke execute on function public.path_uuid(text) from public, anon;
grant execute on function public.path_uuid(text) to authenticated;
