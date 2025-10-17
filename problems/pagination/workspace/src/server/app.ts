import express, { type Express } from 'express';
import cors from 'cors';
import type { Database } from 'sql.js';
import { createDatabase } from './db';
import { listInventory } from './inventoryRepository';

export async function createApp(existingDb?: Database): Promise<Express> {
  const db = existingDb ?? (await createDatabase());
  const app = express();

  app.use(cors());

  app.get('/inventory', (req, res) => {
    const pageParam = req.query.page as string | undefined;
    const limitParam = req.query.limit as string | undefined;

    const page = pageParam ? Number(pageParam) : undefined;
    const limit = limitParam ? Number(limitParam) : undefined;

    const payload = listInventory(db, { page, limit });
    res.json(payload);
  });

  return app;
}
