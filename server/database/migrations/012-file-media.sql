ALTER TABLE catalog_images
    ALTER COLUMN contents DROP NOT NULL,
    ADD COLUMN byte_size integer CHECK (byte_size BETWEEN 1 AND 5242880),
    ADD COLUMN thumbnail_id text CHECK (thumbnail_id ~ '^[a-f0-9]{64}$'),
    ADD CONSTRAINT catalog_images_has_original CHECK (contents IS NOT NULL OR byte_size IS NOT NULL);

ALTER TABLE catalog_audio
    ALTER COLUMN contents DROP NOT NULL,
    ADD COLUMN byte_size integer CHECK (byte_size BETWEEN 1 AND 20971520),
    ADD CONSTRAINT catalog_audio_has_original CHECK (contents IS NOT NULL OR byte_size IS NOT NULL);
