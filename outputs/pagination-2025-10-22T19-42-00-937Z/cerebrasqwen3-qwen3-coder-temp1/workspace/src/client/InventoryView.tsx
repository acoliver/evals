import { useState } from 'react';
import type { InventoryItem } from '../shared/types';
import { useInventory } from './useInventory';

const PAGE_LIMIT = 5;

function InventoryList({ items }: { items: InventoryItem[] }) {
  if (items.length === 0) {
    return <p>No items found.</p>;
  }
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
  const [currentPage, setCurrentPage] = useState(1);
  const { status, data, error } = useInventory(currentPage, PAGE_LIMIT);

  if (status === 'loading' || status === 'idle') {
    return <p>Loading inventory…</p>;
  }

  if (status === 'error' || !data) {
    return <p role="alert">{error ?? 'Unable to load inventory.'}</p>;
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (data.hasNext) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <section>
      <h1>Inventory</h1>
      <InventoryList items={data.items} />
      <div>
        <p>Page {data.page} of {Math.ceil(data.total / data.limit) || 1}</p>
        <button onClick={handlePrevious} disabled={currentPage === 1}>
          Previous
        </button>
        <button onClick={handleNext} disabled={!data.hasNext}>
          Next
        </button>
      </div>
    </section>
  );
}