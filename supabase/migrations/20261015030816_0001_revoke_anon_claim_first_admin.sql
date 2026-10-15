/*
# Tighten claim_first_admin execution permissions

The claim_first_admin function should only be callable by authenticated users
(not anon). The has_role function must remain callable by both anon and
authenticated because RLS policies reference it and policies run as the caller.

## Changes
- Revoke EXECUTE on claim_first_admin() from anon.
*/

REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM anon;