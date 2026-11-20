ALTER TABLE users ALTER COLUMN telegram_id DROP NOT NULL;
ALTER TABLE users
    ADD COLUMN username text UNIQUE CHECK (username ~ '^[a-z0-9][a-z0-9._-]{2,39}$'),
    ADD COLUMN password_salt bytea CHECK (octet_length(password_salt) = 16),
    ADD COLUMN password_hash bytea CHECK (octet_length(password_hash) = 64),
    ADD COLUMN recovery_hash bytea UNIQUE CHECK (octet_length(recovery_hash) = 32),
    ADD CONSTRAINT users_authentication_method CHECK (
        (telegram_id IS NOT NULL AND username IS NULL AND password_salt IS NULL
            AND password_hash IS NULL AND recovery_hash IS NULL)
        OR
        (telegram_id IS NULL AND username IS NOT NULL AND password_salt IS NOT NULL
            AND password_hash IS NOT NULL AND recovery_hash IS NOT NULL)
    );

CREATE TABLE invitation_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code_hash bytea NOT NULL UNIQUE CHECK (octet_length(code_hash) = 32),
    role text NOT NULL CHECK (role IN ('USER', 'JURY')),
    creator_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    expires_at timestamptz NOT NULL CHECK (expires_at > created_at),
    max_uses integer NOT NULL CHECK (max_uses BETWEEN 1 AND 500),
    use_count integer NOT NULL DEFAULT 0 CHECK (use_count BETWEEN 0 AND max_uses),
    revoked_at timestamptz
);
CREATE INDEX invitation_codes_created_idx ON invitation_codes (created_at DESC, id DESC);

CREATE TABLE invitation_uses (
    invitation_id uuid NOT NULL REFERENCES invitation_codes (id) ON DELETE RESTRICT,
    user_id uuid NOT NULL UNIQUE REFERENCES users (id) ON DELETE RESTRICT,
    used_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (invitation_id, user_id)
);
