CREATE TABLE banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  subtitle VARCHAR(500),
  image_path VARCHAR(500) NOT NULL,
  link_url VARCHAR(500),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT banners_date_range_check CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);

CREATE INDEX idx_banners_display_order ON banners(display_order);
CREATE INDEX idx_banners_is_active ON banners(is_active);
CREATE INDEX idx_banners_schedule ON banners(start_date, end_date);

CREATE TABLE hero_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  background_image VARCHAR(500),
  title VARCHAR(200) NOT NULL DEFAULT 'Tu mejor aliado en productos y equipos para fibra óptica y tecnología',
  subtitle TEXT NOT NULL DEFAULT 'Equipos y suministros de fibra óptica y tecnología con asesoría experta. Diseño de proyectos. Stocks disponibles. Soporte a la medida. Envíos inmediatos a nivel nacional.',
  cta_text VARCHAR(100) NOT NULL DEFAULT 'Ver Nuestros Productos',
  cta_link VARCHAR(500) NOT NULL DEFAULT '/productos',
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_hero_settings_singleton ON hero_settings((id IS NOT NULL));

INSERT INTO hero_settings DEFAULT VALUES;
