# Spec: Settings Domain

## Requirements

### REQ-1: Site Settings
The system MUST store and manage site-wide settings:
- Site name
- Site description
- Contact email
- Contact phone
- Address
- Social media links
- Business hours

### REQ-2: Settings Management
Admin MUST be able to:
- View all settings
- Update individual settings
- See when settings were last updated and by whom

### REQ-3: Settings Cache
Settings MUST be cached to avoid database hits on every page load.

## Scenarios

### Scenario 1: Admin updates site name
**Given** current site name is "SOPROTELCO"
**When** admin updates it to "SOPROTELCO SAS"
**Then** site name is updated in database
**And** cache is invalidated
**And** new name appears on public site

### Scenario 2: View all settings
**Given** admin navigates to settings page
**When** page loads
**Then** all settings are displayed with current values
**And** last updated timestamp is shown

### Scenario 3: Invalid setting value
**Given** admin tries to set invalid email format
**When** form is submitted
**Then** validation error is shown
**And** setting is not updated

## Data Model

### Table: settings
```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_settings_key ON settings(key);
```

### Seed Data
```sql
INSERT INTO settings (key, value, description) VALUES
  ('site_name', 'SOPROTELCO', 'Site display name'),
  ('site_description', 'Soluciones en telecomunicaciones', 'Site meta description'),
  ('contact_email', 'ventas@soprotelco.com', 'Contact email'),
  ('contact_phone', '+57 300 123 4567', 'Contact phone'),
  ('address', 'Bogotá, Colombia', 'Business address'),
  ('business_hours', 'Lun-Vie: 8:00-18:00, Sáb: 9:00-13:00', 'Business hours'),
  ('facebook_url', '', 'Facebook page URL'),
  ('instagram_url', '', 'Instagram profile URL'),
  ('linkedin_url', '', 'LinkedIn page URL'),
  ('whatsapp_number', '+573001234567', 'WhatsApp number for contact button');
```

## Validation Rules

- `key`: required, unique, max 100 chars, alphanumeric with underscores
- `value`: optional, text
- `description`: optional, text
- `contact_email`: must be valid email format if key is 'contact_email'

## Authorization

- Read settings: public (for site display)
- Update settings: requires `settings:write` permission
- Admin role has write permission
