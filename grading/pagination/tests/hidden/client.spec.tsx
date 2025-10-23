import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import request from 'supertest';
import { Response } from 'cross-fetch';
import type { Express } from 'express';
import type { Database } from 'sql.js';
import { createApp } from '@workspace/server/app';
import { createDatabase } from '@workspace/server/db';
import { InventoryView } from '@workspace/client/InventoryView';

const BASE_URL = 'http://localhost';

function createFetchForApp(app: Express) {
  return async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toLowerCase();
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const target = new URL(rawUrl, BASE_URL);
    const pathWithQuery = `${target.pathname}${target.search}`;
    const agent = request(app);

    let req = agent[method as 'get' | 'post' | 'put' | 'delete'](pathWithQuery);

    if (init?.headers) {
      Object.entries(init.headers as Record<string, string>).forEach(([key, value]) => {
        req = req.set(key, value);
      });
    }

    if (init?.body) {
      req = req.send(init.body);
    }

    const res = await req;

    return new Response(res.text, {
      status: res.status,
      headers: {
        'Content-Type': res.headers['content-type'] ?? 'application/json'
      }
    });
  };
}

let originalFetch: typeof fetch;
let app: Express;
let db: Database;

beforeEach(async () => {
  db = await createDatabase();
  app = await createApp(db);
  originalFetch = global.fetch;
  global.fetch = createFetchForApp(app) as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('InventoryView pagination behaviour', () => {
  it('navigates between pages and disables buttons appropriately', async () => {
    render(<InventoryView />);

    await waitFor(() => expect(screen.getByRole('heading', { name: /inventory/i })).toBeInTheDocument());

    // Page 1 should include the first item
    expect(screen.getByText(/Notebook/)).toBeInTheDocument();

    const nextButton = screen.getByRole('button', { name: /next/i });
    const prevButton = screen.getByRole('button', { name: /previous/i });

    expect(prevButton).toBeDisabled();

    fireEvent.click(nextButton);

    await waitFor(() => expect(screen.getByText(/Portable SSD/)).toBeInTheDocument());

    expect(prevButton).not.toBeDisabled();

    // Advance to final page
    fireEvent.click(nextButton);

    await waitFor(() => expect(screen.getByText(/Portable Charger/)).toBeInTheDocument());
    expect(nextButton).toBeDisabled();
  });

  it('surfaces server validation errors to the user', async () => {
    render(<InventoryView />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /inventory/i })).toBeInTheDocument());

    const prevButton = screen.getByRole('button', { name: /previous/i });

    fireEvent.click(prevButton);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/page/i));
  });
});
