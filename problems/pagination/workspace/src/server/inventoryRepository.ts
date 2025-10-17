import type { Database } from 'sql.js';
import type { InventoryItem, InventoryPage } from '../shared/types';

const DEFAULT_LIMIT = 5;

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
  options: { page?: number; limit?: number }
): InventoryPage {
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM inventory');
  countStmt.step();
  const total = Number(countStmt.getAsObject().count ?? 0);
  countStmt.free();

  const page = options.page && options.page > 0 ? Math.floor(options.page) : 1;
  const limit = options.limit && options.limit > 0 ? Math.floor(options.limit) : DEFAULT_LIMIT;

  // BUG: offset should be (page - 1) * limit, but the existing code skips the first page entirely.
  const offset = page * limit;

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

  const hasNext = (page + 1) * limit < total;

  return {
    items: rows,
    page,
    limit,
    total,
    hasNext
  };
}
