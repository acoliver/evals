import { useState } from 'react';
import type { InventoryItem } from '../shared/types';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '../shared/pagination';
import { useInventory } from './useInventory';

const PAGE_LIMIT = DEFAULT_LIMIT;

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
  const [page, setPage] = useState<number>(DEFAULT_PAGE);
  const { status, data, error } = useInventory(page, PAGE_LIMIT);

  const isLoading = status === 'loading' || status === 'idle';
  const hasError = status === 'error';
  const items = data?.items ?? [];
  const showEmptyState = !isLoading && !hasError && items.length === 0;
  const showList = !isLoading && !hasError && items.length > 0;
  const currentPage = data?.page ?? page;

  const canGoPrev = page > DEFAULT_PAGE && !isLoading;
  const canGoNext = Boolean(data?.hasNext) && !isLoading;

  const handlePrev = () => {
    if (!canGoPrev) {
      return;
    }
    setPage((prev) => Math.max(DEFAULT_PAGE, prev - 1));
  };

  const handleNext = () => {
    if (!canGoNext) {
      return;
    }
    setPage((prev) => prev + 1);
  };

  return (
    <section>
      <h1>Inventory</h1>
      {isLoading && <p>Loading inventory…</p>}
      {hasError && <p role="alert">{error ?? 'Unable to load inventory.'}</p>}
      {showEmptyState && <p>No inventory items found.</p>}
      {showList && <InventoryList items={items} />}
      <nav aria-label="Pagination controls">
        <button type="button" onClick={handlePrev} disabled={!canGoPrev}>
          Previous
        </button>
        <span aria-live="polite">Page {currentPage}</span>
        <button type="button" onClick={handleNext} disabled={!canGoNext}>
          Next
        </button>
      </nav>
    </section>
  );
}
