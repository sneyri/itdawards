-- Keep legacy account fields for existing records. New code-only accounts
-- have a display name and no legacy credentials.
ALTER TABLE users
    DROP CONSTRAINT users_authentication_method,
    ADD CONSTRAINT users_authentication_method CHECK (
        (username IS NULL AND password_salt IS NULL AND password_hash IS NULL AND recovery_hash IS NULL
            AND (telegram_id IS NOT NULL OR btrim(display_name) <> ''))
        OR
        (telegram_id IS NULL AND username IS NOT NULL AND password_salt IS NOT NULL
            AND password_hash IS NOT NULL AND recovery_hash IS NOT NULL)
    );

ALTER TABLE invitation_codes
    ALTER COLUMN code_hash DROP NOT NULL,
    ADD COLUMN account_id uuid REFERENCES users (id) ON DELETE RESTRICT,
    ADD CONSTRAINT invitation_account_code CHECK (
        (account_id IS NULL AND code_hash IS NOT NULL)
        OR (account_id IS NOT NULL AND code_hash IS NULL AND max_uses = 1)
    ),
    ADD CONSTRAINT invitation_account_key UNIQUE (id, account_id);

ALTER TABLE auth_codes
    ADD COLUMN invitation_id uuid,
    ADD CONSTRAINT auth_code_invitation_owner FOREIGN KEY (invitation_id, user_id)
        REFERENCES invitation_codes (id, account_id);

-- Each invitation still records at most one use per user. Later invitations
-- may refer to the same permanent account.
ALTER TABLE invitation_uses DROP CONSTRAINT invitation_uses_user_id_key;
