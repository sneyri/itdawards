ALTER TABLE catalog_images
    DROP CONSTRAINT catalog_images_contents_check,
    ADD CONSTRAINT catalog_images_contents_check
        CHECK (octet_length(contents) BETWEEN 1 AND 5242880);

CREATE TABLE catalog_audio (
    id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
    media_type text NOT NULL CHECK (media_type IN ('audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm')),
    contents bytea NOT NULL CHECK (octet_length(contents) BETWEEN 1 AND 20971520),
    created_at timestamptz NOT NULL DEFAULT now()
);
