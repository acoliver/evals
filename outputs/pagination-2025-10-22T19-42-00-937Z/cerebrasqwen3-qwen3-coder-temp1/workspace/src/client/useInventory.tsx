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
        // Include page and limit in the fetch request
        const response = await fetch(`/inventory?page=${page}&limit=${limit}`);
        if (!response.ok) {
          // Attempt to read the error message from the response body
          let errorMessage = `Request failed with status ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          } catch (e) {
            // If parsing JSON fails, stick with the default message
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
    // Add page and limit to the dependency array so the effect re-runs when they change
  }, [page, limit]);

  return state;
}