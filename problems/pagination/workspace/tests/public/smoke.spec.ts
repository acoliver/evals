import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app';
import { createDatabase } from '../../src/server/db';

describe('inventory API (public smoke)', () => {
  it('returns some inventory rows', async () => {
    const db = await createDatabase();
    const app = await createApp(db);
    const response = await request(app).get('/inventory');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.items.length).toBeGreaterThan(0);
  });
});
