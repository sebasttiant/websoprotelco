-- Migration 0006: Settings table
-- Stores site-wide configuration settings

CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- Seed default settings
INSERT INTO settings (key, value, description) VALUES
  ('site_name', 'SOPROTELCO', 'Site display name'),
  ('site_description', 'Soluciones integrales en telecomunicaciones, fibra óptica, redes y conectividad para proyectos empresariales en Colombia.', 'Site meta description'),
  ('contact_email', 'ventas@soprotelco.com', 'Contact email'),
  ('contact_phone', '+57 300 123 4567', 'Contact phone'),
  ('address', 'Bogotá, Colombia', 'Business address'),
  ('business_hours', 'Lun-Vie: 8:00-18:00, Sáb: 9:00-13:00', 'Business hours'),
  ('facebook_url', '', 'Facebook page URL'),
  ('instagram_url', '', 'Instagram profile URL'),
  ('linkedin_url', '', 'LinkedIn page URL'),
  ('whatsapp_number', '+573001234567', 'WhatsApp number for contact button')
ON CONFLICT (key) DO NOTHING;
