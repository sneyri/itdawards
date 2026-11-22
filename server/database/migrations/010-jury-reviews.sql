CREATE TABLE jury_reviews (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nomination_id integer NOT NULL REFERENCES nominations (id) ON DELETE CASCADE,
    jury_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    content text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 256),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX jury_reviews_nomination_idx ON jury_reviews (nomination_id, created_at DESC, id DESC);
