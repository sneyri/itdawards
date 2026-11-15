CREATE TABLE IF NOT EXISTS auth_accounts (
    provider_origin text NOT NULL,
    subject text NOT NULL,
    voter_id uuid NOT NULL UNIQUE,
    PRIMARY KEY (provider_origin, subject)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash text PRIMARY KEY,
    voter_id uuid NOT NULL REFERENCES auth_accounts (voter_id),
    expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_session_expiry ON auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS auth_email_codes (
    email text PRIMARY KEY,
    code_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    used boolean NOT NULL DEFAULT false,
    sent_at timestamptz NOT NULL DEFAULT now(),
    sends integer NOT NULL DEFAULT 1,
    window_started_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_email_code_window ON auth_email_codes (window_started_at);

CREATE TABLE IF NOT EXISTS auth_passwords (
    voter_id uuid PRIMARY KEY REFERENCES auth_accounts (voter_id),
    username text NOT NULL UNIQUE,
    password_hash text NOT NULL
);
