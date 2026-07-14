-- Migration 0009: Documents
-- Stores metadata for uploaded PDF documents (manuals, datasheets, certificates, etc.)
-- Files themselves live on disk under public/documents/{category}/, this table tracks
-- the metadata and the optional link back to a product.

CREATE TABLE IF NOT EXISTS documents (
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

CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_product_id ON documents(product_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
