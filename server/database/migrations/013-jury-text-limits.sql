ALTER TABLE jury_votes
    DROP CONSTRAINT jury_votes_justification_check,
    ADD CONSTRAINT jury_votes_justification_check
        CHECK (char_length(btrim(justification)) BETWEEN 1 AND 1000);

ALTER TABLE jury_reviews
    DROP CONSTRAINT jury_reviews_content_check,
    ADD CONSTRAINT jury_reviews_content_check
        CHECK (char_length(btrim(content)) BETWEEN 1 AND 1000);
