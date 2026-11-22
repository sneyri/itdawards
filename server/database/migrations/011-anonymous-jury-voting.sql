CREATE TABLE jury_votes (
    nomination_id integer NOT NULL REFERENCES nominations (id) ON DELETE RESTRICT,
    nominee_id integer NOT NULL,
    jury_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    justification text NOT NULL CHECK (char_length(btrim(justification)) BETWEEN 1 AND 256),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (jury_id, nomination_id),
    FOREIGN KEY (nomination_id, nominee_id)
        REFERENCES nominees (nomination_id, id) ON DELETE RESTRICT
);

CREATE INDEX jury_votes_nomination_nominee_idx ON jury_votes (nomination_id, nominee_id);
CREATE INDEX jury_votes_nomination_updated_idx ON jury_votes (nomination_id, updated_at DESC);
