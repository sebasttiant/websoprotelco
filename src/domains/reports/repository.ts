import "server-only";

import { query } from "@/server/db/pool";

import type {
  CatalogReport,
  CommercialReport,
  DailyTrendPoint,
  MonthlyRevenue,
  NamedCount,
  StatusCount,
  TopProductRow,
} from "./schemas";

function dateClause(from: Date | null, column: string, startIndex: number): { sql: string; values: unknown[] } {
  if (!from) return { sql: "", values: [] };
  return { sql: ` AND ${column} >= $${startIndex}`, values: [from.toISOString()] };
}

const LINE_TOTAL_SUBQUERY = `
  SELECT qr.id, qr.kind, qr.status, qr.created_at,
         CASE
           WHEN bool_or(qri.id IS NOT NULL AND qri.unit_price_cents IS NULL) THEN NULL
           ELSE COALESCE(sum(qri.quantity * qri.unit_price_cents), 0)
         END AS line_total
  FROM quote_requests qr
  LEFT JOIN quote_request_items qri ON qri.quote_request_id = qr.id
  GROUP BY qr.id
`;

export async function findCommercialReport(from: Date | null): Promise<CommercialReport> {
  const { sql, values } = dateClause(from, "created_at", 1);
  const rows = await query<{
    orders: string;
    quotes: string;
    won_orders: string;
    lost_orders: string;
    pending_orders: string;
    open_quotes: string;
    revenue_cents: string;
    won_without_total: string;
  }>(
    `SELECT
       count(*) FILTER (WHERE kind = 'order')::text AS orders,
       count(*) FILTER (WHERE kind = 'quote')::text AS quotes,
       count(*) FILTER (WHERE kind = 'order' AND status = 'won')::text AS won_orders,
       count(*) FILTER (WHERE kind = 'order' AND status = 'lost')::text AS lost_orders,
       count(*) FILTER (WHERE kind = 'order' AND status IN ('received', 'in_review'))::text AS pending_orders,
       count(*) FILTER (WHERE kind = 'quote' AND status IN ('received', 'in_review'))::text AS open_quotes,
       COALESCE(sum(line_total) FILTER (WHERE kind = 'order' AND status = 'won' AND line_total IS NOT NULL), 0)::text AS revenue_cents,
       count(*) FILTER (WHERE kind = 'order' AND status = 'won' AND line_total IS NULL)::text AS won_without_total
     FROM (${LINE_TOTAL_SUBQUERY}) totals
     WHERE true ${sql}`,
    values,
  );

  const row = rows[0];
  const orders = Number.parseInt(row?.orders ?? "0", 10);
  const wonOrders = Number.parseInt(row?.won_orders ?? "0", 10);
  const lostOrders = Number.parseInt(row?.lost_orders ?? "0", 10);
  const decided = wonOrders + lostOrders;

  return {
    orders,
    quotes: Number.parseInt(row?.quotes ?? "0", 10),
    wonOrders,
    lostOrders,
    pendingOrders: Number.parseInt(row?.pending_orders ?? "0", 10),
    openQuotes: Number.parseInt(row?.open_quotes ?? "0", 10),
    revenueCents: Number.parseInt(row?.revenue_cents ?? "0", 10),
    wonWithoutTotal: Number.parseInt(row?.won_without_total ?? "0", 10),
    conversionPercent: decided > 0 ? Math.round((wonOrders / decided) * 1000) / 10 : 0,
  };
}

export async function findStatusBreakdown(
  kind: "order" | "quote",
  from: Date | null,
): Promise<StatusCount[]> {
  const values: unknown[] = [kind];
  const { sql, values: dateValues } = dateClause(from, "created_at", 2);
  values.push(...dateValues);

  const rows = await query<{ status: string; count: string }>(
    `SELECT status, count(*)::text AS count
     FROM quote_requests
     WHERE kind = $1 ${sql}
     GROUP BY status
     ORDER BY count DESC, status ASC`,
    values,
  );

  return rows.map((row) => ({
    status: row.status,
    count: Number.parseInt(row.count, 10),
  }));
}

/** Daily creation counts for orders vs quotes (Bogotá calendar days). */
export async function findDailyTrend(from: Date): Promise<DailyTrendPoint[]> {
  const rows = await query<{ day: string; orders: string; quotes: string }>(
    `SELECT
       to_char((created_at AT TIME ZONE 'America/Bogota'), 'YYYY-MM-DD') AS day,
       count(*) FILTER (WHERE kind = 'order')::text AS orders,
       count(*) FILTER (WHERE kind = 'quote')::text AS quotes
     FROM quote_requests
     WHERE created_at >= $1
     GROUP BY 1
     ORDER BY 1 ASC`,
    [from.toISOString()],
  );

  return rows.map((row) => ({
    date: row.day,
    label: row.day.slice(5),
    orders: Number.parseInt(row.orders, 10),
    quotes: Number.parseInt(row.quotes, 10),
  }));
}

export async function findMonthlyRevenue(months = 6): Promise<MonthlyRevenue[]> {
  const rows = await query<{ month: string; revenue_cents: string; order_count: string }>(
    `SELECT
       to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
       COALESCE(sum(line_total) FILTER (WHERE status = 'won' AND line_total IS NOT NULL), 0)::text AS revenue_cents,
       count(*) FILTER (WHERE status = 'won')::text AS order_count
     FROM (${LINE_TOTAL_SUBQUERY}) totals
     WHERE kind = 'order'
       AND created_at >= date_trunc('month', now()) - ($1::int - 1) * interval '1 month'
     GROUP BY date_trunc('month', created_at)
     ORDER BY date_trunc('month', created_at) ASC`,
    [months],
  );

  return rows.map((row) => ({
    month: row.month,
    revenueCents: Number.parseInt(row.revenue_cents, 10),
    orderCount: Number.parseInt(row.order_count, 10),
  }));
}

export async function findTopProducts(from: Date | null, limit = 10): Promise<TopProductRow[]> {
  const values: unknown[] = [limit];
  let dateSql = "";
  if (from) {
    values.push(from.toISOString());
    dateSql = ` AND qr.created_at >= $${values.length}`;
  }

  const rows = await query<{
    product_id: string | null;
    name: string;
    quantity: string;
    revenue_cents: string;
  }>(
    `SELECT
       qri.product_id,
       COALESCE(p.name, NULLIF(qri.description, ''), 'Producto eliminado') AS name,
       COALESCE(sum(qri.quantity), 0)::text AS quantity,
       COALESCE(sum(qri.quantity * COALESCE(qri.unit_price_cents, 0)), 0)::text AS revenue_cents
     FROM quote_request_items qri
     INNER JOIN quote_requests qr ON qr.id = qri.quote_request_id
     LEFT JOIN products p ON p.id = qri.product_id
     WHERE qr.kind = 'order'
       AND qr.status = 'won'
       ${dateSql}
     GROUP BY qri.product_id, COALESCE(p.name, NULLIF(qri.description, ''), 'Producto eliminado')
     ORDER BY sum(qri.quantity) DESC, name ASC
     LIMIT $1`,
    values,
  );

  return rows.map((row) => ({
    productId: row.product_id,
    name: row.name,
    quantity: Number.parseInt(row.quantity, 10),
    revenueCents: Number.parseInt(row.revenue_cents, 10),
  }));
}

export async function findCatalogReport(lowStockThreshold = 5): Promise<CatalogReport> {
  const rows = await query<{
    total: string;
    active: string;
    inactive: string;
    missing_image: string;
    low_stock: string;
    out_of_stock: string;
    catalog_value_cents: string;
  }>(
    `WITH stock AS (
       SELECT p.id, p.is_active, p.image_url, p.price_cents,
              COALESCE(SUM(m.quantity), 0)::bigint AS current_stock
       FROM products p
       LEFT JOIN stock_movements m ON m.product_id = p.id
       GROUP BY p.id
     )
     SELECT
       count(*)::text AS total,
       count(*) FILTER (WHERE is_active)::text AS active,
       count(*) FILTER (WHERE NOT is_active)::text AS inactive,
       count(*) FILTER (WHERE image_url IS NULL OR btrim(image_url) = '')::text AS missing_image,
       count(*) FILTER (WHERE is_active AND current_stock > 0 AND current_stock < $1)::text AS low_stock,
       count(*) FILTER (WHERE is_active AND current_stock <= 0)::text AS out_of_stock,
       COALESCE(sum(price_cents * GREATEST(current_stock, 0)) FILTER (WHERE is_active), 0)::text AS catalog_value_cents
     FROM stock`,
    [lowStockThreshold],
  );

  const row = rows[0];
  return {
    total: Number.parseInt(row?.total ?? "0", 10),
    active: Number.parseInt(row?.active ?? "0", 10),
    inactive: Number.parseInt(row?.inactive ?? "0", 10),
    missingImage: Number.parseInt(row?.missing_image ?? "0", 10),
    lowStock: Number.parseInt(row?.low_stock ?? "0", 10),
    outOfStock: Number.parseInt(row?.out_of_stock ?? "0", 10),
    catalogValueCents: Number.parseInt(row?.catalog_value_cents ?? "0", 10),
  };
}

export async function findProductsByCategory(): Promise<NamedCount[]> {
  const rows = await query<{ name: string; count: string }>(
    `SELECT COALESCE(c.name, 'Sin categoría') AS name, count(p.id)::text AS count
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     GROUP BY COALESCE(c.name, 'Sin categoría')
     ORDER BY count(p.id) DESC, name ASC`,
  );

  return rows.map((row) => ({
    name: row.name,
    count: Number.parseInt(row.count, 10),
  }));
}

export async function findLeadsByStatus(from: Date | null): Promise<StatusCount[]> {
  const { sql, values } = dateClause(from, "created_at", 1);
  const rows = await query<{ status: string; count: string }>(
    `SELECT status, count(*)::text AS count
     FROM leads
     WHERE true ${sql}
     GROUP BY status
     ORDER BY count DESC, status ASC`,
    values,
  );

  return rows.map((row) => ({
    status: row.status,
    count: Number.parseInt(row.count, 10),
  }));
}

export async function findLeadsBySource(from: Date | null): Promise<NamedCount[]> {
  const { sql, values } = dateClause(from, "created_at", 1);
  const rows = await query<{ name: string; count: string }>(
    `SELECT source AS name, count(*)::text AS count
     FROM leads
     WHERE true ${sql}
     GROUP BY source
     ORDER BY count DESC, source ASC`,
    values,
  );

  return rows.map((row) => ({
    name: row.name,
    count: Number.parseInt(row.count, 10),
  }));
}

export async function countLeadsInRange(from: Date | null): Promise<number> {
  const { sql, values } = dateClause(from, "created_at", 1);
  const rows = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM leads WHERE true ${sql}`,
    values,
  );
  return Number.parseInt(rows[0]?.count ?? "0", 10);
}

export interface ExportOrderRow {
  reference: string;
  kind: string;
  status: string;
  contactName: string;
  contactEmail: string;
  companyName: string | null;
  createdAt: string;
  itemCount: number;
  totalCents: number | null;
}

export async function findExportOrders(from: Date | null, kind?: "order" | "quote"): Promise<ExportOrderRow[]> {
  const values: unknown[] = [];
  const parts: string[] = ["true"];

  if (kind) {
    values.push(kind);
    parts.push(`kind = $${values.length}`);
  }
  if (from) {
    values.push(from.toISOString());
    parts.push(`created_at >= $${values.length}`);
  }

  const rows = await query<{
    reference: string;
    kind: string;
    status: string;
    contact_name: string;
    contact_email: string;
    company_name: string | null;
    created_at: string;
    item_count: string;
    line_total: string | null;
  }>(
    `SELECT reference, kind, status, contact_name, contact_email, company_name, created_at,
            item_count, line_total
     FROM (
       SELECT qr.reference, qr.kind, qr.status, qr.contact_name, qr.contact_email, qr.company_name,
              qr.created_at,
              count(qri.id)::text AS item_count,
              CASE
                WHEN bool_or(qri.id IS NOT NULL AND qri.unit_price_cents IS NULL) THEN NULL
                ELSE COALESCE(sum(qri.quantity * qri.unit_price_cents), 0)::text
              END AS line_total
       FROM quote_requests qr
       LEFT JOIN quote_request_items qri ON qri.quote_request_id = qr.id
       GROUP BY qr.id
     ) totals
     WHERE ${parts.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT 5000`,
    values,
  );

  return rows.map((row) => ({
    reference: row.reference,
    kind: row.kind,
    status: row.status,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    companyName: row.company_name,
    createdAt: row.created_at,
    itemCount: Number.parseInt(row.item_count, 10),
    totalCents: row.line_total === null ? null : Number.parseInt(row.line_total, 10),
  }));
}
