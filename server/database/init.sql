CREATE TABLE IF NOT EXISTS nominations (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title text NOT NULL CHECK (btrim(title) <> ''),
    description text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nominations
    ADD COLUMN IF NOT EXISTS emoji text,
    ADD COLUMN IF NOT EXISTS suggestions_preview boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS nominees (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nomination_id integer NOT NULL REFERENCES nominations (id) ON DELETE CASCADE,
    name text NOT NULL CHECK (btrim(name) <> ''),
    description text NOT NULL DEFAULT '',
    image_url text,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (nomination_id, id)
);

CREATE TABLE IF NOT EXISTS votes (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id uuid NOT NULL,
    nomination_id integer NOT NULL,
    nominee_id integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, nomination_id),
    FOREIGN KEY (nomination_id, nominee_id) REFERENCES nominees (nomination_id, id)
);

CREATE INDEX IF NOT EXISTS nominations_display_idx ON nominations (sort_order, id);
CREATE INDEX IF NOT EXISTS nominees_display_idx ON nominees (nomination_id, sort_order, id);
CREATE INDEX IF NOT EXISTS votes_tally_idx ON votes (nomination_id, nominee_id);
