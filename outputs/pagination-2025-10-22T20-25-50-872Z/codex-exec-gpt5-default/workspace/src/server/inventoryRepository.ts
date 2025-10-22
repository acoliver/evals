import type { Database } from 'sql.js';
import type { InventoryItem, InventoryPage } from '../shared/types';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '../shared/pagination';

function mapRow(row: Record<string, unknown>): InventoryItem {
  return {
    id: Number(row.id),
    name: String(row.name),
    sku: String(row.sku),
    priceCents: Number(row.priceCents),
    createdAt: String(row.createdAt)
  };
}

export function listInventory(
  db: Database,
  options: { page?: number; limit?: number } = {}
): InventoryPage {
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM inventory');
  countStmt.step();
  const total = Number(countStmt.getAsObject().count ?? 0);
  countStmt.free();

  const rawPage = options.page ?? DEFAULT_PAGE;
  const rawLimit = options.limit ?? DEFAULT_LIMIT;

  if (!Number.isInteger(rawPage) || rawPage < 1) {
    throw new Error('Invalid page argument provided to listInventory');
  }

  if (!Number.isInteger(rawLimit) || rawLimit < 1) {
    throw new Error('Invalid limit argument provided to listInventory');
  }

  const page = rawPage;
  const limit = rawLimit;
  const offset = (page - 1) * limit;

  const stmt = db.prepare(
    `SELECT id, name, sku, price_cents AS priceCents, created_at AS createdAt
     FROM inventory
     ORDER BY id
     LIMIT $limit OFFSET $offset`
  );
  stmt.bind({ $limit: limit, $offset: offset });

  const rows: InventoryItem[] = [];
  while (stmt.step()) {
    rows.push(mapRow(stmt.getAsObject()));
  }
  stmt.free();

  const hasNext = offset + rows.length < total;

  return {
    items: rows,
    page,
    limit,
    total,
    hasNext
  };
}
