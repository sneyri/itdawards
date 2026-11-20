CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id bigint NOT NULL UNIQUE CHECK (telegram_id BETWEEN 1 AND 4503599627370495),
    display_name text NOT NULL DEFAULT '' CHECK (char_length(display_name) <= 120),
    role text NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'JURY', 'MANAGER', 'SUPERADMIN')),
    blocked boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz
);

CREATE TABLE auth_codes (
    user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    code_hash bytea NOT NULL UNIQUE CHECK (octet_length(code_hash) = 32),
    issued_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL CHECK (expires_at > issued_at),
    used_at timestamptz
);

CREATE TABLE sessions (
    token_hash bytea PRIMARY KEY CHECK (octet_length(token_hash) = 32),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE settings (
    id smallint PRIMARY KEY CHECK (id = 1),
    voting_open boolean NOT NULL DEFAULT false,
    opens_at timestamptz,
    closes_at timestamptz,
    allow_vote_changes boolean NOT NULL DEFAULT false,
    jury_weight integer NOT NULL DEFAULT 5 CHECK (jury_weight BETWEEN 1 AND 100),
    results_published boolean NOT NULL DEFAULT false,
    CHECK (opens_at IS NULL OR closes_at IS NULL OR opens_at < closes_at),
    CHECK (NOT (voting_open AND results_published))
);
INSERT INTO settings (id) VALUES (1);

CREATE TABLE audit_logs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id uuid REFERENCES users (id) ON DELETE RESTRICT,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    details jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_target_idx ON audit_logs (target_type, target_id, id DESC);

ALTER TABLE nominations ADD COLUMN image_url text;
ALTER TABLE nominees ADD COLUMN link_url text, ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- The old ballot used browser and email UUIDs. Preserve those rows without
-- assigning them to Telegram users. Every new UUID is checked by the FK.
ALTER TABLE votes
    ADD COLUMN voter_role text CHECK (voter_role IN ('USER', 'JURY', 'MANAGER', 'SUPERADMIN')),
    ADD COLUMN weight integer NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 100),
    ADD COLUMN updated_at timestamptz,
    ADD CONSTRAINT votes_requires_role CHECK (voter_role IS NOT NULL) NOT VALID,
    ADD CONSTRAINT votes_user_fk FOREIGN KEY (user_id) REFERENCES users (id) NOT VALID;
