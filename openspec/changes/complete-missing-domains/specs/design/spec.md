# Spec: Design Domain

## Requirements

### REQ-1: Banner Management
The system MUST manage homepage banners with:
- Title
- Subtitle/description
- Image (stored in filesystem)
- Link URL (optional)
- Display order
- Active/inactive status
- Start date (optional, for scheduled banners)
- End date (optional, for scheduled banners)

### REQ-2: Banner Display
The system MUST:
- Show active banners on homepage
- Respect display order
- Support scheduled banners (only show between start/end dates)
- Limit to max 5 visible banners

### REQ-3: Hero Customization
Admin MUST be able to customize the hero section:
- Background image
- Main title
- Subtitle
- CTA button text and link

## Scenarios

### Scenario 1: Create banner
**Given** admin is on design page
**When** they create a banner with title "Promoción Enero", image, and order 1
**Then** banner is stored and marked active
**And** appears on homepage in correct order

### Scenario 2: Scheduled banner
**Given** a banner with start_date 2026-01-01 and end_date 2026-01-31
**When** current date is 2026-01-15
**Then** banner is visible
**When** current date is 2026-02-01
**Then** banner is not visible

### Scenario 3: Reorder banners
**Given** 3 banners with orders 1, 2, 3
**When** admin changes order of banner 3 to 1
**Then** banners are reordered: 3, 1, 2

## Data Model

### Table: banners
```sql
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_banners_display_order ON banners(display_order);
CREATE INDEX idx_banners_is_active ON banners(is_active);
```

### Table: hero_settings
```sql
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

-- Only one row allowed
CREATE UNIQUE INDEX idx_hero_settings_singleton ON hero_settings((id IS NOT NULL));
```

## File Storage

Banner images are stored in: `public/uploads/banners/{uuid}_{filename}.{ext}`
Hero background images are stored in: `public/uploads/hero/{uuid}_{filename}.{ext}`

## Validation Rules

- `title`: required, max 200 chars
- `subtitle`: optional, max 500 chars
- `image_path`: required, max 500 chars
- `link_url`: optional, valid URL if provided
- `display_order`: integer, default 0
- `is_active`: boolean, default true
- `start_date`: optional, must be before end_date if both provided
- `end_date`: optional, must be after start_date if both provided
- Image validation: same as product images (JPEG/PNG/WebP, magic bytes)

## Authorization

- Read banners: public (for homepage display)
- Manage banners: requires `design:write` permission
- Admin role has write permission
