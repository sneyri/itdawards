ALTER TABLE sessions
    ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    ADD COLUMN created_at timestamptz,
    ADD COLUMN method text NOT NULL DEFAULT 'unknown'
        CHECK (method IN ('unknown', 'telegram', 'invitation', 'password', 'recovery'));

ALTER TABLE sessions ALTER COLUMN created_at SET DEFAULT clock_timestamp();

CREATE TABLE login_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    method text NOT NULL CHECK (method IN ('telegram', 'invitation', 'password', 'recovery')),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX login_events_user_idx ON login_events (user_id, created_at DESC, id DESC);
