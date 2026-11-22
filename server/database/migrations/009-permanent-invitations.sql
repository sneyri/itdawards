ALTER TABLE invitation_codes ALTER COLUMN expires_at DROP NOT NULL;
ALTER TABLE auth_codes ALTER COLUMN expires_at DROP NOT NULL;

UPDATE invitation_codes
SET expires_at = NULL
WHERE account_id IS NOT NULL
    AND revoked_at IS NULL
    AND use_count < max_uses
    AND expires_at > clock_timestamp();

UPDATE auth_codes AS code
SET expires_at = NULL
FROM invitation_codes AS invitation
WHERE invitation.id = code.invitation_id
    AND invitation.expires_at IS NULL
    AND invitation.revoked_at IS NULL
    AND code.used_at IS NULL
    AND code.expires_at > clock_timestamp();
