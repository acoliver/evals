import express, { type Express } from 'express';
import cors from 'cors';
import type { Database } from 'sql.js';
import { createDatabase } from './db';
import { listInventory } from './inventoryRepository';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  MAX_PAGE
} from '../shared/pagination';

class PaginationValidationError extends Error {}

function coerceInteger(value: string | undefined, name: 'page' | 'limit'): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    throw new PaginationValidationError(`Query parameter "${name}" must be a number.`);
  }

  if (!Number.isInteger(parsed)) {
    throw new PaginationValidationError(`Query parameter "${name}" must be an integer.`);
  }

  return parsed;
}

function validatePaginationParams(
  pageParam: string | undefined,
  limitParam: string | undefined
): { page: number; limit: number } {
  const page = coerceInteger(pageParam, 'page') ?? DEFAULT_PAGE;
  const limit = coerceInteger(limitParam, 'limit') ?? DEFAULT_LIMIT;

  if (page < 1) {
    throw new PaginationValidationError('Query parameter "page" must be greater than or equal to 1.');
  }

  if (page > MAX_PAGE) {
    throw new PaginationValidationError(`Query parameter "page" must be less than or equal to ${MAX_PAGE}.`);
  }

  if (limit < 1) {
    throw new PaginationValidationError('Query parameter "limit" must be greater than or equal to 1.');
  }

  if (limit > MAX_LIMIT) {
    throw new PaginationValidationError(`Query parameter "limit" must be less than or equal to ${MAX_LIMIT}.`);
  }

  return { page, limit };
}

export async function createApp(existingDb?: Database): Promise<Express> {
  const db = existingDb ?? (await createDatabase());
  const app = express();

  app.use(cors());

  app.get('/inventory', (req, res) => {
    try {
      const { page, limit } = validatePaginationParams(
        req.query.page as string | undefined,
        req.query.limit as string | undefined
      );

      const payload = listInventory(db, { page, limit });
      res.json(payload);
    } catch (error) {
      if (error instanceof PaginationValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: 'Internal server error.' });
    }
  });

  return app;
}
