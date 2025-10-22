import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FormData {
  firstName: string;
  lastName: string;
  streetAddress: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  email: string;
  phone: string;
}

interface ValidationError {
  field: string;
  message: string;
}

import { Database } from 'sql.js';

let db: Database | null = null;

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-()]+$/;
  return phoneRegex.test(phone) && phone.length > 0;
}

function validatePostalCode(postalCode: string): boolean {
  const postalRegex = /^[A-Za-z0-9\s-]+$/;
  return postalRegex.test(postalCode) && postalCode.length > 0;
}

function validateFormData(data: Partial<FormData>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.firstName?.trim()) {
    errors.push({ field: 'firstName', message: 'First name is required' });
  }

  if (!data.lastName?.trim()) {
    errors.push({ field: 'lastName', message: 'Last name is required' });
  }

  if (!data.streetAddress?.trim()) {
    errors.push({ field: 'streetAddress', message: 'Street address is required' });
  }

  if (!data.city?.trim()) {
    errors.push({ field: 'city', message: 'City is required' });
  }

  if (!data.stateProvince?.trim()) {
    errors.push({ field: 'stateProvince', message: 'State/Province/Region is required' });
  }

  if (!data.postalCode?.trim()) {
    errors.push({ field: 'postalCode', message: 'Postal/Zip code is required' });
  } else if (!validatePostalCode(data.postalCode)) {
    errors.push({ field: 'postalCode', message: 'Invalid postal code format' });
  }

  if (!data.country?.trim()) {
    errors.push({ field: 'country', message: 'Country is required' });
  }

  if (!data.email?.trim()) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!validateEmail(data.email)) {
    errors.push({ field: 'email', message: 'Invalid email format' });
  }

  if (!data.phone?.trim()) {
    errors.push({ field: 'phone', message: 'Phone number is required' });
  } else if (!validatePhone(data.phone)) {
    errors.push({ field: 'phone', message: 'Invalid phone number format' });
  }

  return errors;
}

async function initializeDatabase(): Promise<void> {
  try {
    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs();
    
    const dbPath = path.join(__dirname, '..', 'data', 'submissions.sqlite');
    
    try {
      const dbFile = await fs.readFile(dbPath);
      const u8array = new Uint8Array(dbFile.buffer);
      db = new SQL.Database(u8array);
    } catch (error) {
      db = new SQL.Database();
    }

    const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    db!.run(schemaContent);
    
    await saveDatabase();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

async function saveDatabase(): Promise<void> {
  if (!db) return;
  
  try {
    const dbPath = path.join(__dirname, '..', 'data', 'submissions.sqlite');
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
    const data = db.export();
    await fs.writeFile(dbPath, Buffer.from(data));
  } catch (error) {
    console.error('Failed to save database:', error);
    throw error;
  }
}

function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/public', express.static(path.join(__dirname, '..', 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates'));

app.get('/', (req: Request, res: Response) => {
  res.render('form', {
    errors: [],
    values: {}
  });
});

app.post('/submit', (req: Request, res: Response) => {
  const formData: Partial<FormData> = {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    streetAddress: req.body.streetAddress,
    city: req.body.city,
    stateProvince: req.body.stateProvince,
    postalCode: req.body.postalCode,
    country: req.body.country,
    email: req.body.email,
    phone: req.body.phone
  };

  const errors = validateFormData(formData);

  if (errors.length > 0) {
    return res.status(400).render('form', {
      errors: errors.map(e => e.message),
      values: formData
    });
  }

  try {
    const stmt = db!.prepare(`
      INSERT INTO submissions (
        first_name, last_name, street_address, city, state_province, 
        postal_code, country, email, phone, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    
    stmt.run([
      formData.firstName,
      formData.lastName,
      formData.streetAddress,
      formData.city,
      formData.stateProvince,
      formData.postalCode,
      formData.country,
      formData.email,
      formData.phone
    ]);
    
    stmt.free();
    saveDatabase();
    
    res.redirect(302, '/thank-you');
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).render('form', {
      errors: ['Database error occurred. Please try again.'],
      values: formData
    });
  }
});

app.get('/thank-you', (req: Request, res: Response) => {
  const firstName = req.query.firstName as string || 'friend';
  res.render('thank-you', { firstName });
});

let server: { close: (callback?: () => void) => void; on: (event: string, listener: (error: Error & { code?: string; syscall?: string }) => void) => void } | null = null;

async function startServer(): Promise<void> {
  try {
    await initializeDatabase();
    
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    
    server = app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });

    server.on('error', (error: Error & { code?: string; syscall?: string }) => {
      if (error.syscall !== 'listen') {
        throw error;
      }
      const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;
      switch (error.code) {
        case 'EACCES':
          console.error(bind + ' requires elevated privileges');
          process.exit(1);
          break;
        case 'EADDRINUSE':
          console.error(bind + ' is already in use');
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

function shutdown(): void {
  console.log('Shutting down server...');
  if (server) {
    server.close(() => {
      console.log('Server closed');
      closeDatabase();
      process.exit(0);
    });
  } else {
    closeDatabase();
    process.exit(0);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startServer();