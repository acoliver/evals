import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { Server } from 'node:http';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';

type SubmissionValues = {
  firstName: string;
  lastName: string;
  streetAddress: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  email: string;
  phone: string;
};

const requiredFields: Array<keyof SubmissionValues> = [
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const templatesDir = path.resolve(projectRoot, 'src', 'templates');
const publicDir = path.resolve(projectRoot, 'public');
const dataDir = path.resolve(projectRoot, 'data');
const dbFilePath = path.resolve(dataDir, 'submissions.sqlite');
const schemaPath = path.resolve(projectRoot, 'db', 'schema.sql');
const wasmDir = path.resolve(projectRoot, 'node_modules', 'sql.js', 'dist');

class SubmissionStore {
  private closed = false;

  private constructor(private readonly db: Database, private readonly filePath: string) {}

  static async initialize(sql: SqlJsStatic, filePath: string, schemaFilePath: string): Promise<SubmissionStore> {
    await mkdir(path.dirname(filePath), { recursive: true });
    const schema = await readFile(schemaFilePath, 'utf8');

    let database: Database;
    if (existsSync(filePath)) {
      const buffer = await readFile(filePath);
      database = new sql.Database(new Uint8Array(buffer));
    } else {
      database = new sql.Database();
    }

    database.exec(schema);
    const store = new SubmissionStore(database, filePath);

    if (!existsSync(filePath)) {
      await store.persist();
    }

    return store;
  }

  async insert(values: SubmissionValues): Promise<void> {
    if (this.closed) {
      throw new Error('Attempted to insert into a closed database.');
    }

    this.db.run(
      `INSERT INTO submissions (
        first_name,
        last_name,
        street_address,
        city,
        state_province,
        postal_code,
        country,
        email,
        phone
      ) VALUES (
        $firstName,
        $lastName,
        $streetAddress,
        $city,
        $stateProvince,
        $postalCode,
        $country,
        $email,
        $phone
      )`,
      {
        $firstName: values.firstName,
        $lastName: values.lastName,
        $streetAddress: values.streetAddress,
        $city: values.city,
        $stateProvince: values.stateProvince,
        $postalCode: values.postalCode,
        $country: values.country,
        $email: values.email,
        $phone: values.phone,
      },
    );

    await this.persist();
  }

  async persist(): Promise<void> {
    const data = this.db.export();
    await writeFile(this.filePath, Buffer.from(data));
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.db.close();
    this.closed = true;
  }

  get isClosed(): boolean {
    return this.closed;
  }
}

function getEmptyValues(): SubmissionValues {
  return {
    firstName: '',
    lastName: '',
    streetAddress: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    country: '',
    email: '',
    phone: '',
  };
}

function coerceToTrimmedString(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function parseSubmission(body: Record<string, unknown>): SubmissionValues {
  return {
    firstName: coerceToTrimmedString(body.firstName),
    lastName: coerceToTrimmedString(body.lastName),
    streetAddress: coerceToTrimmedString(body.streetAddress),
    city: coerceToTrimmedString(body.city),
    stateProvince: coerceToTrimmedString(body.stateProvince),
    postalCode: coerceToTrimmedString(body.postalCode),
    country: coerceToTrimmedString(body.country),
    email: coerceToTrimmedString(body.email),
    phone: coerceToTrimmedString(body.phone),
  };
}

function validate(values: SubmissionValues): { values: SubmissionValues; errors: string[] } {
  const errors: string[] = [];

  for (const field of requiredFields) {
    if (!values[field]) {
      const label = field
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (char) => char.toUpperCase());
      errors.push(`${label} is required.`);
    }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (values.email && !emailRegex.test(values.email)) {
    errors.push('Please enter a valid email address.');
  }

  const phoneRegex = /^\+?[0-9\s\-()]{7,}$/;
  if (values.phone && !phoneRegex.test(values.phone)) {
    errors.push('Phone numbers may include digits, spaces, parentheses, dashes, and an optional leading "+".');
  }

  const postalRegex = /^[A-Za-z0-9][A-Za-z0-9\s-]*$/;
  if (values.postalCode && !postalRegex.test(values.postalCode)) {
    errors.push('Postal code should include only letters, numbers, spaces, or dashes.');
  }

  return { values, errors };
}

function buildApp(store: SubmissionStore): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('view engine', 'ejs');
  app.set('views', templatesDir);

  app.use('/public', express.static(publicDir));
  app.use(express.urlencoded({ extended: false }));

  app.get('/', (_req: Request, res: Response) => {
    res.render('form', { values: getEmptyValues(), errors: [] });
  });

  app.post('/submit', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = parseSubmission(req.body as Record<string, unknown>);
      const { values, errors } = validate(parsed);

      if (errors.length > 0) {
        res.status(400).render('form', { values, errors });
        return;
      }

      await store.insert(values);
      const redirectTarget = `/thank-you?firstName=${encodeURIComponent(values.firstName)}`;
      res.redirect(302, redirectTarget);
    } catch (error) {
      next(error);
    }
  });

  app.get('/thank-you', (req: Request, res: Response) => {
    const firstNameParam = Array.isArray(req.query.firstName) ? req.query.firstName[0] : req.query.firstName;
    const firstName =
      typeof firstNameParam === 'string' && firstNameParam.trim().length > 0 ? firstNameParam.trim() : 'friend';

    res.render('thank-you', { firstName });
  });

  app.use((error: Error, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    // eslint-disable-next-line no-console
    console.error('Unexpected server error', error);
    res.status(500).send('Something went wrong processing your request.');
  });

  return app;
}

async function initializeResources(): Promise<{ app: Express; store: SubmissionStore }> {
  const sql = await initSqlJs({
    locateFile: (fileName: string) => path.resolve(wasmDir, fileName),
  });

  const store = await SubmissionStore.initialize(sql, dbFilePath, schemaPath);
  const app = buildApp(store);
  return { app, store };
}

const resourcesPromise = initializeResources();

let httpServer: Server | undefined;
let shuttingDown = false;
let gracefulHandlersRegistered = false;

function registerGracefulShutdown(): void {
  if (gracefulHandlersRegistered) {
    return;
  }
  gracefulHandlersRegistered = true;

  const handleSignal = async (): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    try {
      await stopServer();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGTERM', handleSignal);
  process.on('SIGINT', handleSignal);
}

function startListening(app: Express, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      registerGracefulShutdown();
      resolve(server);
    });

    server.on('error', (error) => {
      reject(error);
    });
  });
}

export async function startServer(customPort?: number): Promise<{ app: Express; server: Server; store: SubmissionStore }> {
  if (httpServer) {
    const resources = await resourcesPromise;
    return { ...resources, server: httpServer };
  }

  const resources = await resourcesPromise;
  const port = typeof customPort === 'number' ? customPort : Number(process.env.PORT) || 3000;
  httpServer = await startListening(resources.app, port);
  return { ...resources, server: httpServer };
}

export async function stopServer(): Promise<void> {
  const resources = await resourcesPromise;

  if (httpServer) {
    const serverToClose = httpServer;
    httpServer = undefined;
    await new Promise<void>((resolve, reject) => {
      serverToClose.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  if (!resources.store.isClosed) {
    resources.store.close();
  }
}

export async function getApp(): Promise<Express> {
  const { app } = await resourcesPromise;
  return app;
}

export async function getStore(): Promise<SubmissionStore> {
  const { store } = await resourcesPromise;
  return store;
}

function isMainModule(url: string): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return url === pathToFileURL(entry).href;
}

if (isMainModule(import.meta.url)) {
  startServer()
    .then(({ server }) => {
      const address = server.address();
      if (address && typeof address === 'object') {
        // eslint-disable-next-line no-console
        console.log(`Server listening on port ${address.port}`);
      }
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Failed to start server', error);
      process.exit(1);
    });
}
