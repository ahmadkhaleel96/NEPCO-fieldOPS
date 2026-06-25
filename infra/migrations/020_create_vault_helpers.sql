-- Migration 020: Vault helper RPCs for NFC tag write passwords
-- Public wrapper functions so the API (service_role) can call
-- vault.create_secret / vault.decrypted_secrets without schema-qualified calls.
-- Both functions are restricted to service_role — no other role can execute them.

CREATE OR REPLACE FUNCTION public.nfc_vault_create(
  p_secret text,
  p_name   text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
BEGIN
  RETURN vault.create_secret(p_secret, p_name, 'NTAG write password');
END;
$$;

REVOKE ALL ON FUNCTION public.nfc_vault_create(text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.nfc_vault_create(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.nfc_vault_read(
  p_id uuid
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret
    INTO v_secret
    FROM vault.decrypted_secrets
   WHERE id = p_id;
  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public.nfc_vault_read(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.nfc_vault_read(uuid) TO service_role;
