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

  // Fix the offset calculation to be (page - 1) * limit
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

  // Fix hasNext calculation to compare the offset + limit (next page's start) to the total count
  const hasNext = offset + limit < total;

  return {
    items: rows,
    page,
    limit,
    total,
    hasNext
  };
}