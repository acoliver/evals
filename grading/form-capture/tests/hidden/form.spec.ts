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

// Task breakdown for scoring
const TASKS = [
  'form-renders-correctly',
  'invalid-email-validation',
  'form-data-persistence',
  'thank-you-page-display',
  'css-styling-applied',
  'package-integrity'
];

const RESULTS_PATH = path.join(workspaceRoot, 'results', 'form-capture.json');
const status = new Map<string, boolean>(TASKS.map((id) => [id, false]));

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
  // Start server
  serverProcess = spawn('node', [distServer], {
    stdio: ['ignore', 'ignore', 'ignore'],
    env: { ...process.env, WASM_DIR: wasmDir, PORT: '0' }
  });

  // Extract port from server output (simplified approach)
  await new Promise((resolve) => setTimeout(resolve, 2000));
  port = 3001; // Use fixed port for testing
});

afterAll(async () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

describe('form capture hidden validations with breakdown', () => {
  const baseUrl = `http://localhost:${port}`;

  it('renders form without errors', async () => {
    const response = await fetch(baseUrl);
    expect(response.ok).toBe(true);
    
    const html = await response.text();
    const $ = loadHtml(html);
    
    // Check for form elements
    expect($('form').length).toBeGreaterThan(0);
    expect($('input[type="text"]').length).toBeGreaterThan(0);
    expect($('input[type="email"]').length).toBeGreaterThan(0);
    
    status.set('form-renders-correctly', true);
  });

  it('validates email format correctly', async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'name=Test&email=invalid-email&message=Test message'
    });
    
    const html = await response.text();
    const $ = loadHtml(html);
    
    // Should show validation error for invalid email
    expect($('.error').length).toBeGreaterThan(0);
    
    status.set('invalid-email-validation', true);
  });

  it('persists valid form data to database', async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'name=Test User&email=test@example.com&message=Test message'
    });
    
    expect(response.ok).toBe(true);
    
    // Check database for persisted data
    const SQL = await initSqlJs();
    const databaseData = fs.readFileSync(dbPath);
    const db = new SQL.Database(databaseData);
    
    const result = db.exec('SELECT COUNT(*) as count FROM submissions WHERE email = "test@example.com"');
    const count = result[0].values[0][0];
    
    expect(count).toBeGreaterThan(0);
    
    status.set('form-data-persistence', true);
  });

  it('displays thank you page after successful submission', async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'name=Thank You Test&email=thank@test.com&message=Thank you test'
    });
    
    const html = await response.text();
    const $ = loadHtml(html);
    
    // Should contain thank you message
    expect($('body').text().toLowerCase()).toContain('thank');
    
    status.set('thank-you-page-display', true);
  });

  it('applies CSS styling correctly', async () => {
    const response = await fetch(baseUrl);
    const html = await response.text();
    const $ = loadHtml(html);
    
    // Check for CSS classes or styling
    const styleContent = $('style').html() || $('link[rel="stylesheet"]').attr('href');
    expect(styleContent).toBeDefined();
    
    status.set('css-styling-applied', true);
  });
});

afterAll(async () => {
  // Check package integrity
  try {
    const workspacePackagePath = path.join(workspaceRoot, 'package.json');
    const baselinePackagePath = path.join(
      workspaceRoot,
      '..',
      '..',
      '..',
      'problems',
      'form-capture',
      'workspace',
      'package.json'
    );

    const workspacePackage = JSON.parse(fs.readFileSync(workspacePackagePath, 'utf8'));
    const baselinePackage = JSON.parse(fs.readFileSync(baselinePackagePath, 'utf8'));

    if (workspacePackage.dependencies === baselinePackage.dependencies &&
        workspacePackage.devDependencies === baselinePackage.devDependencies &&
        workspacePackage.scripts === baselinePackage.scripts) {
      status.set('package-integrity', true);
    }
  } catch (error) {
    // Leave package-integrity as false
  }

  // Write results
  fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
  const results = TASKS.map((taskId) => ({ taskId, passed: status.get(taskId) === true }));
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2), 'utf8');
});