ALTER TABLE users DROP CONSTRAINT users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'staff', 'customer'));

ALTER TABLE users ALTER COLUMN role SET DEFAULT 'customer';
