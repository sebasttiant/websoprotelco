-- Account self-service fields.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS full_name text;

UPDATE users
SET full_name = split_part(email, '@', 1)
WHERE full_name IS NULL;
