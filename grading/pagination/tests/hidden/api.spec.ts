import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Database } from 'sql.js';
import { createApp } from '@workspace/server/app';
import { createDatabase } from '@workspace/server/db';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(__dirname, '..', '..', 'workspace');
const resultsPath = path.join(workspaceRoot, 'results', 'pagination.json');
const ALL_TASKS = [
  'api-mid-page-request',
  'api-final-page-handling',
  'api-invalid-parameter-handling',
  'client-navigation',
  'client-alert'
] as const;

const taskStatus = new Map<string, boolean>(ALL_TASKS.map((taskId) => [taskId, false]));

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
    taskStatus.set('api-mid-page-request', true);
  });

  it('indicates when the final page has been reached', async () => {
    const response = await request(app).get('/inventory').query({ page: 3, limit: 6 });

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(3);
    expect(response.body.hasNext).toBe(false);
    taskStatus.set('api-final-page-handling', true);
  });

  it('rejects invalid pagination parameters', async () => {
    const response = await request(app).get('/inventory').query({ page: 0, limit: 100 });

    expect(response.status).toBe(400);
    expect((response.body.error ?? '').toLowerCase()).toContain('page');
    taskStatus.set('api-invalid-parameter-handling', true);
  });
});

afterAll(() => {
  if (fs.existsSync(resultsPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(resultsPath, 'utf8')) as Array<{
        taskId: string;
        passed: boolean;
      }>;
      for (const { taskId, passed } of existing) {
        if (taskStatus.has(taskId) && passed) {
          taskStatus.set(taskId, true);
        }
      }
    } catch {
      // ignore malformed existing data
    }
  }

  fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  const results = ALL_TASKS.map((taskId) => ({
    taskId,
    passed: taskStatus.get(taskId) === true
  }));
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), 'utf8');
});
