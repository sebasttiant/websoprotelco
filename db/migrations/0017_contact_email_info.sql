-- Point the default ops / contact mailbox to info@ as requested for structured
-- order and form notifications. Only updates the seeded default (or an unchanged
-- ventas@ mailbox); an intentionally different admin-configured address is kept.

UPDATE settings
SET value = 'info@soprotelco.com', updated_at = now()
WHERE key = 'contact_email'
  AND (value IS NULL OR lower(trim(value)) IN ('', 'ventas@soprotelco.com'));
