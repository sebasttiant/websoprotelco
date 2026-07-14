# Spec: Documents Domain

## Requirements

### REQ-1: Document Management
The system MUST manage documents (PDFs, technical sheets) with:
- Title
- Description
- File path (stored in filesystem)
- Category (manual, datasheet, certificate, other)
- Associated product (optional)
- Upload date
- Uploaded by user

### REQ-2: Document Upload
Admin MUST be able to:
- Upload PDF documents
- Associate document with a product (optional)
- Set document category
- Add title and description

### REQ-3: Document Listing
The system MUST provide:
- Paginated list of all documents
- Filter by category
- Filter by associated product
- Download link for each document

## Scenarios

### Scenario 1: Upload technical sheet
**Given** admin is on documents page
**When** they upload a PDF with title "Ficha Técnica Router X" and category "datasheet"
**Then** document is stored in filesystem
**And** metadata is saved in database
**And** document appears in list

### Scenario 2: Filter documents by category
**Given** 20 documents with various categories
**When** admin filters by category "datasheet"
**Then** only datasheet documents are shown

### Scenario 3: Download document
**Given** a document exists
**When** user clicks download
**Then** file is served from filesystem
**And** download count is incremented (optional)

## Data Model

### Table: documents
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(300) NOT NULL,
  description TEXT,
  file_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(200) NOT NULL,
  file_size INTEGER,
  category VARCHAR(50) NOT NULL DEFAULT 'other' CHECK (category IN ('manual', 'datasheet', 'certificate', 'warranty', 'other')),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_category ON documents(category);
CREATE INDEX idx_documents_product_id ON documents(product_id);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);
```

## File Storage

Documents are stored in: `public/documents/{category}/{uuid}_{filename}.pdf`

## Validation Rules

- `title`: required, max 300 chars
- `description`: optional
- `file_path`: required, max 500 chars
- `file_name`: required, max 200 chars
- `file_size`: optional, in bytes
- `category`: must be one of 'manual', 'datasheet', 'certificate', 'warranty', 'other'
- File type: PDF only (validated by magic bytes)
- Max file size: 10MB

## Authorization

- Read documents: public (for customer downloads)
- Upload documents: requires `documents:write` permission
- Delete documents: requires `documents:write` permission
- Admin and staff roles have write permission
