import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import initSqlJs from 'sql.js';
import { load as loadHtml } from 'cheerio';

const gradingRoot = path.resolve(__dirname, '..', '..');
const workspaceRoot = path.resolve(gradingRoot, 'workspace');
const distServer = path.join(workspaceRoot, 'dist', 'server.js');
const dbPath = path.join(workspaceRoot, 'data', 'submissions.sqlite');
const wasmDir = path.join(gradingRoot, 'node_modules', 'sql.js', 'dist');

let serverProcess: ReturnType<typeof spawn> | null = null;
let port = 0;

const waitForServer = async (url: string, attempts = 40): Promise<void> => {
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) {
        return;
      }
    } catch {
      // ignore until server becomes ready
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Server did not start in time');
};

beforeAll(async () => {
  port = 4100 + Math.floor(Math.random() * 500);
  serverProcess = spawn('node', [distServer], {
    cwd: workspaceRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: 'pipe'
  });

  serverProcess.stderr?.on('data', (data) => {
    // bubble up useful errors during debugging
    process.stderr.write(data);
  });

  await waitForServer(`http://127.0.0.1:${port}/`);
});

afterAll(async () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  serverProcess = null;
});

describe('form capture hidden validations', () => {
  it('renders form with all expected fields', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    const $ = loadHtml(html);
    const fieldNames = [
      'firstName',
      'lastName',
      'streetAddress',
      'city',
      'stateProvince',
      'postalCode',
      'country',
      'email',
      'phone'
    ];
    for (const name of fieldNames) {
      const input = $(`input[name="${name}"]`);
      expect(input.length).toBe(1);
    }
  });

  it('rejects invalid email and re-renders with errors', async () => {
    const form = new URLSearchParams({
      firstName: 'Ana',
      lastName: 'García',
      streetAddress: 'Av. Siempre Viva 123',
      city: 'Buenos Aires',
      stateProvince: 'CABA',
      postalCode: 'C1000',
      country: 'Argentina',
      email: 'not-an-email',
      phone: '+54 9 11 6543-2100'
    });

    const res = await fetch(`http://127.0.0.1:${port}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      redirect: 'manual'
    });

    expect(res.status === 200 || res.status === 400).toBe(true);
    const html = await res.text();
    const $ = loadHtml(html);
    const errorText = $('.error-list').text().toLowerCase();
    expect(errorText).toContain('email');
  });

  it('accepts international postal codes and phones and stores submission', async () => {
    if (fs.existsSync(dbPath)) {
      fs.rmSync(dbPath);
    }

    const form = new URLSearchParams({
      firstName: 'Lucía',
      lastName: 'Martínez',
      streetAddress: 'Calle Falsa 123',
      city: 'Rosario',
      stateProvince: 'Santa Fe',
      postalCode: 'S2000',
      country: 'Argentina',
      email: 'lucia@example.com',
      phone: '+54 341 123 4567'
    });

    const res = await fetch(`http://127.0.0.1:${port}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      redirect: 'manual'
    });

    expect([302, 303]).toContain(res.status);
    const location = res.headers.get('location');
    expect(location).toBeTruthy();
    expect(location?.startsWith('/thank-you')).toBe(true);
    const cookie = res.headers.get('set-cookie') ?? '';

    const SQL = await initSqlJs({ locateFile: (file: string) => path.join(wasmDir, file) });
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer) as any;
    const stmt = db.prepare('SELECT first_name, postal_code, phone FROM submissions ORDER BY id DESC LIMIT 1');
    const typedStmt = stmt as unknown as { step: () => boolean; getAsObject: () => Record<string, string> };
    expect(typedStmt.step()).toBe(true);
    const row = typedStmt.getAsObject();
    expect(row.first_name).toBe('Lucía');
    expect(row.postal_code).toBe('S2000');
    expect(row.phone).toBe('+54 341 123 4567');
    stmt.free();
    db.close();

    const thankYou = await fetch(`http://127.0.0.1:${port}/thank-you`, {
      headers: cookie ? { Cookie: cookie } : undefined
    });
    expect(thankYou.status).toBe(200);
    const thankHtml = await thankYou.text();
    const lowered = thankHtml.toLowerCase();
    expect(
      lowered.includes('spam') ||
        lowered.includes('dubious') ||
        lowered.includes('friendly messages')
    ).toBe(true);
    expect(lowered).toContain('identity');
    expect(lowered).toContain('stranger');
  });

  it('has meaningful modern styling', () => {
    const cssPath = path.join(workspaceRoot, 'public', 'styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    expect(css.length).toBeGreaterThan(120);
    expect(css).toMatch(/display:\s*(flex|grid)/i);
    expect(css.toLowerCase()).toContain('color-scheme');
  });
});
