import type { InventoryItem } from '../shared/types';
import { useInventory } from './useInventory';

const PAGE_LIMIT = 5;

function InventoryList({ items }: { items: InventoryItem[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <strong>{item.name}</strong> <span>({item.sku})</span> – ${(item.priceCents / 100).toFixed(2)}
        </li>
      ))}
    </ul>
  );
}

export function InventoryView() {
  const { status, data, error } = useInventory(1, PAGE_LIMIT);

  if (status === 'loading' || status === 'idle') {
    return <p>Loading inventory…</p>;
  }

  if (status === 'error' || !data) {
    return <p role="alert">{error ?? 'Unable to load inventory.'}</p>;
  }

  return (
    <section>
      <h1>Inventory</h1>
      <InventoryList items={data.items} />
      {/* BUG: pagination controls missing */}
    </section>
  );
}
