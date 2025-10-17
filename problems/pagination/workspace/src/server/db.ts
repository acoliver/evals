import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';

const SEED_PATH = path.resolve(__dirname, '../../data/seed.sql');
let sqlJsInstance: Promise<SqlJsStatic> | undefined;

function locateWasm(file: string): string {
  const candidates = [
    path.resolve(__dirname, '../../node_modules/sql.js/dist', file),
    path.resolve(__dirname, '../../../node_modules/sql.js/dist', file),
    path.resolve(process.cwd(), 'node_modules/sql.js/dist', file)
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return file;
}

function getSqlModule(): Promise<SqlJsStatic> {
  if (!sqlJsInstance) {
    sqlJsInstance = initSqlJs({
      locateFile: locateWasm
    });
  }

  return sqlJsInstance;
}

export async function createDatabase(): Promise<Database> {
  const SQL = await getSqlModule();
  const db = new SQL.Database();
  const seed = readFileSync(SEED_PATH, 'utf8');
  db.run(seed);
  return db;
}
