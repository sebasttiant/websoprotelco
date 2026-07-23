import { Client } from "pg";

import { getTestDatabaseUrl } from "./database-url";

async function seedDatabase(): Promise<void> {
  const client = new Client({ connectionString: getTestDatabaseUrl() });
  await client.connect();

  try {
    await client.query("CREATE TABLE IF NOT EXISTS seed_metadata (key text PRIMARY KEY, value text NOT NULL)");
    await client.query(
      "INSERT INTO seed_metadata (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      ["foundation", "ready"],
    );
    // This seed is intentionally executed only after the destructive `_test` reset and migrations.
    await client.query("INSERT INTO categories (id, slug, name, display_order) VALUES ('11111111-1111-4111-8111-111111111111', 'fibra', 'Fibra óptica', 1), ('22222222-2222-4222-8222-222222222222', 'sin-productos', 'Sin productos', 2)");
    await client.query("INSERT INTO products (id, category_id, sku, slug, name, description, price_cents, currency, image_url, brand, stock_quantity) VALUES ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'FIB-001', 'fusionadora-segura', 'Fusionadora segura', 'Equipo de prueba.', 1500000, 'COP', NULL, 'SOPROTELCO', 2), ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'FIB-002', 'imagen-no-segura', 'Imagen no segura', 'Debe usar el marcador local.', 1200000, 'COP', 'https://project.supabase.co/storage/v1/object/public/products/catalog.png', 'SOPROTELCO', 1)");
  } finally {
    await client.end();
  }
}

seedDatabase().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
