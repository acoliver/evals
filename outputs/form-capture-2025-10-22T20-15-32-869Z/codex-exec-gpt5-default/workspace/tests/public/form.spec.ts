/* eslint-disable */
// @ts-nocheck
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { startServer, stopServer } from '../../src/server';

let server: any;
let app: any;
const dbPath = path.resolve('data', 'submissions.sqlite');

beforeAll(async () => {
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  const started = await startServer(0);
  server = started.server;
  app = started.app;
});

afterAll(async () => {
  await stopServer();
});

describe('friendly form (public smoke)', () => {
  it('renders the form with all fields', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);

    const $ = cheerio.load(response.text);
    const expectedNames = [
      'firstName',
      'lastName',
      'streetAddress',
      'city',
      'stateProvince',
      'postalCode',
      'country',
      'email',
      'phone',
    ];

    for (const name of expectedNames) {
      expect($(`input[name="${name}"]`)).toHaveLength(1);
    }
  });

  it('persists submission and redirects', async () => {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    const payload = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      streetAddress: '1 Analytical Engine Way',
      city: 'London',
      stateProvince: 'Greater London',
      postalCode: 'SW1A 1AA',
      country: 'United Kingdom',
      email: 'ada@example.com',
      phone: '+44 20 7946 0958',
    };

    const response = await request(app).post('/submit').type('form').send(payload);
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('/thank-you');

    const SQL = await initSqlJs({
      locateFile: (fileName: string) => path.resolve('node_modules', 'sql.js', 'dist', fileName),
    });
    const dbBytes = fs.readFileSync(dbPath);
    const database = new SQL.Database(new Uint8Array(dbBytes));
    const result = database.exec('SELECT first_name, country, email FROM submissions');
    expect(result[0].values[0]).toEqual(['Ada', 'United Kingdom', 'ada@example.com']);
    database.close();
  });
});
