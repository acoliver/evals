import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Database } from 'sql.js';
import { createApp } from '@workspace/server/app';
import { createDatabase } from '@workspace/server/db';
import path from 'node:path';
import fs from 'node:fs';

const gradingRoot = path.resolve(__dirname, '..', '..');
const workspaceRoot = path.resolve(gradingRoot, 'workspace');

// Task breakdown for scoring
const TASKS = [
  'api-mid-page-request',
  'api-final-page-handling',
  'api-invalid-parameter-handling'
];

const RESULTS_PATH = path.join(workspaceRoot, 'results', 'pagination-api.json');
const status = new Map<string, boolean>(TASKS.map((id) => [id, false]));

let app: Express;
let db: Database;

beforeEach(async () => {
  db = await createDatabase();
  app = await createApp(db);
});

describe('API pagination hidden validations with breakdown', () => {
  it('returns the correct slice of data for a mid-page request', async () => {
    const response = await request(app).get('/inventory').query({ page: 2, limit: 4 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      page: 2,
      limit: 4,
      total: 15,
      hasNext: true
    });

    const ids = response.body.items.map((item: { id: number }) => item.id);
    expect(ids).toEqual([5, 6, 7, 8]);
    
    status.set('api-mid-page-request', true);
  });

  it('handles final page edges correctly', async () => {
    const response = await request(app).get('/inventory').query({ page: 4, limit: 4 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      page: 4,
      limit: 4,
      total: 15,
      hasNext: false
    });

    const ids = response.body.items.map((item: { id: number }) => item.id);
    expect(ids).toEqual([13, 14, 15]);
    
    status.set('api-final-page-handling', true);
  });

  it('handles invalid parameters gracefully', async () => {
    // Test negative page
    const response1 = await request(app).get('/inventory').query({ page: -1, limit: 10 });
    expect(response1.status).toBe(400);

    // Test zero or negative limit
    const response2 = await request(app).get('/inventory').query({ page: 1, limit: 0 });
    expect(response2.status).toBe(400);

    // Test very large limit
    const response3 = await request(app).get('/inventory').query({ page: 1, limit: 1000 });
    expect(response3.status).toBe(200);
    expect(response3.body.limit).toBeLessThanOrEqual(100); // Should cap at reasonable limit
    
    status.set('api-invalid-parameter-handling', true);
  });
});

afterAll(() => {
  fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
  const results = TASKS.map((taskId) => ({ taskId, passed: status.get(taskId) === true }));
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2), 'utf8');
});