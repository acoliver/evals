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

function PaginationControls({ 
  currentPage, 
  hasNext, 
  onPageChange,
  isLoading 
}: { 
  currentPage: number; 
  hasNext: boolean; 
  onPageChange: (page: number) => void;
  isLoading: boolean;
}) {
  const hasPrevious = currentPage > 1;

  return (
    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <button 
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!hasPrevious || isLoading}
        aria-label="Previous page"
      >
        Previous
      </button>
      <span>Page {currentPage}</span>
      <button 
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!hasNext || isLoading}
        aria-label="Next page"
      >
        Next
      </button>
      {isLoading && <span>Loading...</span>}
    </div>
  );
}

export function InventoryView() {
  const [currentPage, setCurrentPage] = useState(1);
  const { status, data, error } = useInventory(currentPage, PAGE_LIMIT);

  if (status === 'loading' || status === 'idle') {
    return <p>Loading inventory…</p>;
  }

  if (status === 'error') {
    return <p role="alert">{error ?? 'Unable to load inventory.'}</p>;
  }

  if (!data) {
    return <p role="alert">Unable to load inventory.</p>;
  }

  return (
    <section>
      <h1>Inventory</h1>
      <InventoryList items={data.items} />
      <PaginationControls
        currentPage={data.page}
        hasNext={data.hasNext}
        onPageChange={setCurrentPage}
        isLoading={false}
      />
      <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
        Showing {data.items.length} of {data.total} items (limit: {data.limit})
      </div>
    </section>
  );
}
