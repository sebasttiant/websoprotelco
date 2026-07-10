-- Quote request ownership. Bind each quote request to a user so account history is
-- scoped by an immutable user_id instead of a mutable contact_email. ON DELETE SET NULL
-- keeps quote history intact when a user is removed.

ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS quote_requests_user_id_idx ON quote_requests (user_id);

-- Backfill existing rows by matching the contact email exactly once. This is the only
-- link available at migration time; new rows are bound to the session user at insert.
UPDATE quote_requests qr
SET user_id = u.id
FROM users u
WHERE lower(qr.contact_email) = lower(u.email) AND qr.user_id IS NULL;
