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

    // Validation for page parameter
    let page: number | undefined;
    if (pageParam !== undefined) {
      if (!/^\d+$/.test(pageParam)) {
        return res.status(400).json({ error: 'Page parameter must be a positive integer.' });
      }
      const parsedPage = Number(pageParam);
      if (parsedPage <= 0 || parsedPage > 10000) { // Assuming 10000 is an excessive page number
        return res.status(400).json({ error: 'Page parameter out of valid range (1-10000).' });
      }
      page = parsedPage;
    }

    // Validation for limit parameter
    let limit: number | undefined;
    if (limitParam !== undefined) {
      if (!/^\d+$/.test(limitParam)) {
        return res.status(400).json({ error: 'Limit parameter must be a positive integer.' });
      }
      const parsedLimit = Number(limitParam);
      if (parsedLimit <= 0 || parsedLimit > 100) { // Assuming 100 is an excessive limit
        return res.status(400).json({ error: 'Limit parameter out of valid range (1-100).' });
      }
      limit = parsedLimit;
    }

    try {
      const payload = listInventory(db, { page, limit });
      res.json(payload);
    } catch (error) {
      console.error('Error listing inventory:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  });

  return app;
}