-- Migration 0014: Move default business address to Medellín.
-- 0006 already ran in production with Bogotá; never edit applied migrations.

UPDATE settings
SET value = 'Medellín, Colombia',
    updated_at = NOW()
WHERE key = 'address';
