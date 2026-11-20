ALTER TABLE nominees
    ADD COLUMN handle text CHECK (char_length(handle) <= 100),
    ADD COLUMN song text CHECK (char_length(song) <= 200),
    ADD COLUMN image_alt text CHECK (char_length(image_alt) <= 300),
    ADD COLUMN audio_url text;
