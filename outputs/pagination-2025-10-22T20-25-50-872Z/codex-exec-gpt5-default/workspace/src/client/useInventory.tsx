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
    const controller = new AbortController();

    async function load() {
      setState((prev) => ({ ...prev, status: 'loading', error: null }));
      try {
        const query = new URLSearchParams({
          page: String(page),
          limit: String(limit)
        });

        const response = await fetch(`/inventory?${query.toString()}`, {
          signal: controller.signal
        });
        if (!response.ok) {
          let message = `Request failed with status ${response.status}`;
          try {
            const errorPayload = (await response.json()) as { error?: unknown };
            if (errorPayload && typeof errorPayload === 'object' && 'error' in errorPayload) {
              const errorValue = (errorPayload as { error?: unknown }).error;
              if (typeof errorValue === 'string') {
                message = errorValue;
              }
            }
          } catch {
            // ignore JSON parse errors when preparing the message
          }
          throw new Error(message);
        }
        const payload = (await response.json()) as InventoryPage;
        if (!cancelled) {
          setState({ status: 'ready', data: payload, error: null });
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        const name = (error as { name?: string } | null)?.name;
        if (name === 'AbortError') {
          return;
        }

        const message = error instanceof Error ? error.message : 'Unknown error';
        setState({ status: 'error', data: null, error: message });
      }
    }

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [page, limit]);

  return state;
}
