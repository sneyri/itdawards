CREATE TABLE catalog_images (
    id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
    media_type text NOT NULL CHECK (media_type IN ('image/png', 'image/jpeg', 'image/webp')),
    contents bytea NOT NULL CHECK (octet_length(contents) BETWEEN 1 AND 2097152),
    created_at timestamptz NOT NULL DEFAULT now()
);
