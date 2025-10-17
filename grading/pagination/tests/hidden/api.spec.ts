import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Database } from 'sql.js';
import { createApp } from '@workspace/server/app';
import { createDatabase } from '@workspace/server/db';

let app: Express;
let db: Database;

beforeEach(async () => {
  db = await createDatabase();
  app = await createApp(db);
});

describe('GET /inventory pagination', () => {
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
  });

  it('indicates when the final page has been reached', async () => {
    const response = await request(app).get('/inventory').query({ page: 3, limit: 6 });

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(3);
    expect(response.body.hasNext).toBe(false);
  });

  it('rejects invalid pagination parameters', async () => {
    const response = await request(app).get('/inventory').query({ page: 0, limit: 100 });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: expect.stringContaining('page')
    });
  });
});
