import { useEffect, useState } from 'react';
import type { InventoryPage } from '../shared/types';

interface InventoryState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: InventoryPage | null;
  error: string | null;
}

const INITIAL_STATE: InventoryState = {
  status: 'idle',
  data: null,
  error: null
};

export function useInventory(page: number, limit: number) {
  const [state, setState] = useState<InventoryState>(INITIAL_STATE);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((prev) => ({ ...prev, status: 'loading', error: null }));
      try {
        const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
        const response = await fetch(`/inventory?${params}`);
        
        if (!response.ok) {
          // Try to parse error from server response
          let errorMessage = `Request failed with status ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // If we can't parse JSON, use the default message
          }
          throw new Error(errorMessage);
        }
        
        const payload = (await response.json()) as InventoryPage;
        if (!cancelled) {
          setState({ status: 'ready', data: payload, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          setState({ status: 'error', data: null, error: message });
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [page, limit]);

  return state;
}
