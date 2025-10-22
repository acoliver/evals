import express, { Application, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { ValidationError } from './types.js'; // Assuming a types file exists or will be created

// @ts-expect-error sql.js types are not fully compatible but this works
import initSqlJs, { Database } from 'sql.js';

// --- Configuration ---
const PORT: number = parseInt(process.env.PORT || '3000', 10);
const DB_PATH = path.join(__dirname, '..', 'data', 'submissions.sqlite');
const SCHEMA_PATH = path.join(__dirname, '..', 'db', 'schema.sql');

// --- Types ---
interface FormSubmission {
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

// --- App Setup ---
const app: Application = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates'));
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

let db: Database | null = null;
let server: any = null; // TODO: Find a better type for the Express server instance

// --- Validation ---
const validateSubmission = (data: Record<string, string>): ValidationError[] => {
  const errors: ValidationError[] = [];
  const requiredFields: (keyof FormSubmission)[] = [
    'firstName', 'lastName', 'streetAddress', 'city',
    'stateProvince', 'postalCode', 'country', 'email', 'phone'
  ];

  requiredFields.forEach(field => {
    if (!data[field] || data[field].toString().trim() === '') {
      errors.push({ field, message: `${field} is required.` });
    }
  });

  // Simple email regex validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (data.email && !emailRegex.test(data.email)) {
    errors.push({ field: 'email', message: 'Please enter a valid email address.' });
  }

  // Flexible phone number validation (allows +, digits, spaces, dashes, parentheses)
  const phoneRegex = /^[+]?[\d\s\-()]+$/;
  if (data.phone && !phoneRegex.test(data.phone)) {
    errors.push({ field: 'phone', message: 'Please enter a valid phone number.' });
  }

  // Flexible postal code validation (allows letters, digits, spaces, dashes)
  const postalCodeRegex = /^[a-zA-Z0-9\s-]+$/;
  if (data.postalCode && !postalCodeRegex.test(data.postalCode)) {
    errors.push({ field: 'postalCode', message: 'Please enter a valid postal code.' });
  }

  return errors;
};

// --- Database ---
const initDatabase = async (): Promise<Database> => {
  const SQL = await initSqlJs({ locateFile: (filename: string) => `node_modules/sql.js/dist/${filename}` });
  let dbBuffer: Buffer | null = null;

  if (fs.existsSync(DB_PATH)) {
    dbBuffer = fs.readFileSync(DB_PATH);
  }

  const database = new SQL.Database(dbBuffer);
  
  // Ensure the table exists
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  database.run(schema);

  return database;
};

const saveSubmission = (formData: FormSubmission): void => {
  if (!db) {
      console.error("Database not initialized");
      return;
  }
  const stmt = db.prepare(`
    INSERT INTO submissions 
    (first_name, last_name, street_address, city, state_province, postal_code, country, email, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    formData.phone,
  ]);
  stmt.free(); // Frees the statement

  // Write the database to disk
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
};

// --- Routes ---
app.get('/', (req: Request, res: Response) => {
  res.render('form', { errors: [], values: {} });
});

app.post('/submit', (req: Request, res: Response) => {
  const data = req.body;
  const errors = validateSubmission(data);

  if (errors.length > 0) {
    const errorMessages = errors.map(e => e.message);
    res.status(400).render('form', { errors: errorMessages, values: data });
    return;
  }

  // Save to database
  saveSubmission({
    firstName: data.firstName,
    lastName: data.lastName,
    streetAddress: data.streetAddress,
    city: data.city,
    stateProvince: data.stateProvince,
    postalCode: data.postalCode,
    country: data.country,
    email: data.email,
    phone: data.phone,
  });

  // Redirect on success
  res.redirect('/thank-you?name=' + encodeURIComponent(data.firstName));
});

app.get('/thank-you', (req: Request, res: Response) => {
  const firstName = req.query.name || 'Friend';
  res.render('thank-you', { firstName });
});

// --- Server Lifecycle ---
const startServer = async () => {
  try {
    db = await initDatabase();
    console.log('Database initialized.');
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }

  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

const gracefulShutdown = () => {
  console.log('Received signal to shut down. Closing server and database...');
  if (server) {
    server.close(() => {
      console.log('Express server closed.');
    });
  }
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    db.close();
    console.log('Database closed.');
  }
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

startServer();