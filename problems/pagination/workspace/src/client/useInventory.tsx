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
        const response = await fetch(`/inventory`);
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
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

    if (state.status === 'idle') {
      load();
    }

    return () => {
      cancelled = true;
    };
    // BUG: page and limit should trigger reloads but are intentionally missing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
