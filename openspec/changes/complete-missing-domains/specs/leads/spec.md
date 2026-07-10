# Spec: Leads Domain

## Requirements

### REQ-1: Lead Capture
The system MUST capture leads from the contact form with:
- Name
- Email
- Phone (optional)
- Subject
- Message
- Source (contact form, WhatsApp, manual)
- Status (new, contacted, qualified, converted, lost)

### REQ-2: Lead Management
Admin MUST be able to:
- View all leads with filtering by status
- Update lead status
- Add internal notes
- Assign leads to staff members

### REQ-3: Lead Notifications
When a new lead is captured, the system MUST:
- Store it in the database
- Mark it as "new" status
- Make it visible in admin panel

## Scenarios

### Scenario 1: Customer submits contact form
**Given** a customer fills the contact form
**When** they submit with valid data
**Then** a lead is created with status "new" and source "contact_form"
**And** admin can see it in the leads panel

### Scenario 2: Admin updates lead status
**Given** a lead with status "new"
**When** admin changes status to "contacted"
**Then** lead status is updated
**And** timestamp is recorded

### Scenario 3: Filter leads by status
**Given** 10 leads with various statuses
**When** admin filters by status "new"
**Then** only leads with status "new" are shown

### Scenario 4: Add internal note
**Given** a lead
**When** admin adds an internal note
**Then** note is stored with timestamp and user
**And** note is visible in lead details

## Data Model

### Table: leads
```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  subject VARCHAR(300),
  message TEXT NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'contact_form' CHECK (source IN ('contact_form', 'whatsapp', 'manual', 'other')),
  status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
```

### Table: lead_notes
```sql
CREATE TABLE lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_notes_lead_id ON lead_notes(lead_id);
```

## Validation Rules

- `name`: required, max 200 chars
- `email`: required, valid email format
- `phone`: optional, max 50 chars
- `subject`: optional, max 300 chars
- `message`: required
- `source`: must be one of 'contact_form', 'whatsapp', 'manual', 'other'
- `status`: must be one of 'new', 'contacted', 'qualified', 'converted', 'lost'

## Authorization

- Create lead (public): no auth required (contact form)
- Read leads: requires `leads:read` permission
- Update leads: requires `leads:write` permission
- Admin and staff roles have both permissions
