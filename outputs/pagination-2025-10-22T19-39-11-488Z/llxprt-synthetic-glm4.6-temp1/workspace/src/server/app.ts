import express, { type Express } from 'express';
import cors from 'cors';
import type { Database } from 'sql.js';
import { createDatabase } from './db';
import { listInventory } from './inventoryRepository';

function validatePaginationParams(pageParam: string | undefined, limitParam: string | undefined) {
  // Default values
  let page = 1;
  let limit = 5;

  // Parse and validate page
  if (pageParam !== undefined) {
    const parsedPage = Number(pageParam);
    if (isNaN(parsedPage) || !Number.isInteger(parsedPage) || parsedPage <= 0 || parsedPage > 1000) {
      return { error: 'Invalid page parameter. Must be a positive integer not exceeding 1000.' };
    }
    page = parsedPage;
  }

  // Parse and validate limit
  if (limitParam !== undefined) {
    const parsedLimit = Number(limitParam);
    if (isNaN(parsedLimit) || !Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 100) {
      return { error: 'Invalid limit parameter. Must be a positive integer not exceeding 100.' };
    }
    limit = parsedLimit;
  }

  return { page, limit };
}

export async function createApp(existingDb?: Database): Promise<Express> {
  const db = existingDb ?? (await createDatabase());
  const app = express();

  app.use(cors());

  app.get('/inventory', (req, res) => {
    const pageParam = req.query.page as string | undefined;
    const limitParam = req.query.limit as string | undefined;

    const validation = validatePaginationParams(pageParam, limitParam);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const payload = listInventory(db, { page: validation.page!, limit: validation.limit! });
    res.json(payload);
  });

  return app;
}
