import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import request from 'supertest';
import { Response } from 'cross-fetch';
import type { Express } from 'express';
import type { Database } from 'sql.js';
import { createApp } from '@workspace/server/app';
import { createDatabase } from '@workspace/server/db';
import { InventoryView } from '@workspace/client/InventoryView';
import path from 'node:path';
import fs from 'node:fs';

const gradingRoot = path.resolve(__dirname, '..', '..');
const workspaceRoot = path.resolve(gradingRoot, 'workspace');

// Task breakdown for scoring
const TASKS = [
  'client-navigation-functionality',
  'client-alert-edge-case'
];

const RESULTS_PATH = path.join(workspaceRoot, 'results', 'pagination-client.json');
const status = new Map<string, boolean>(TASKS.map((id) => [id, false]));

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

    const response = await req;
    const body = await response.text;
    return new Response(body, {
      status: response.status,
      headers: response.headers as Record<string, string>
    });
  };
}

let fetchMock: ReturnType<typeof createFetchForApp>;

beforeEach(async () => {
  const db = await createDatabase();
  const app = await createApp(db);
  fetchMock = createFetchForApp(app);
  // @ts-ignore
  global.fetch = fetchMock;
});

afterEach(() => {
  // @ts-ignore  
  delete global.fetch;
});

describe('Client pagination hidden validations with breakdown', () => {
  it('navigates between pages correctly', async () => {
    render(<InventoryView />, {
      wrapper: ({ children }) => <>{children}</>
    });

    // Wait for initial data to load
    await waitFor(() => {
      expect(screen.getByText(/Item 1/)).toBeInTheDocument();
    });

    // Check navigation buttons exist
    const nextButton = screen.getByText(/next/i);
    const prevButton = screen.queryByText(/previous/i);
    
    expect(nextButton).toBeInTheDocument();
    expect(prevButton).not.toBeInTheDocument(); // No previous on first page

    // Navigate to next page
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText(/Item 5/)).toBeInTheDocument();
    });

    // Now previous should exist
    const prevButtonAfter = screen.getByText(/previous/i);
    expect(prevButtonAfter).toBeInTheDocument();
    
    status.set('client-navigation-functionality', true);
  });

  it('handles edge case alerts gracefully', async () => {
    // Mock alert
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<InventoryView />, {
      wrapper: ({ children }) => <>{children}</>
    });

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText(/Item 1/)).toBeInTheDocument();
    });

    // Try to navigate to invalid page (should trigger alert)
    const lastPageButton = screen.getByText(/page 4/i);
    fireEvent.click(lastPageButton);

    // Try to go beyond last page
    const nextButton = screen.queryByText(/next/i);
    if (nextButton) {
      fireEvent.click(nextButton);
    }

    // Should have shown some alert message
    expect(alertSpy).toHaveBeenCalled();
    
    // Clean up
    alertSpy.mockRestore();
    
    status.set('client-alert-edge-case', true);
  });
});

afterAll(() => {
  fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
  const results = TASKS.map((taskId) => ({ taskId, passed: status.get(taskId) === true }));
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2), 'utf8');
});