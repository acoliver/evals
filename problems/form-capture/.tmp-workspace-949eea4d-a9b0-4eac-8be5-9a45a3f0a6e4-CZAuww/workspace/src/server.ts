import express, { Request, Response, NextFunction } from 'express';
import * as path from 'node:path';
import { db } from './database.js';
import { FormValidator } from './validation.js';
import type { FormSubmission, FormDataWithErrors } from './types.js';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'src', 'templates'));

// Routes
app.get('/', (req: Request, res: Response) => {
  res.render('form', { 
    errors: {},
    formData: {} as Partial<FormSubmission>
  });
});

app.post('/submit', (req: Request, res: Response) => {
  const formData = req.body as Partial<FormSubmission>;
  
  const validation = FormValidator.validateSubmission(formData);
  
  if (!validation.isValid) {
    const errors = FormValidator.formatErrorsAsRecord(validation.errors);
    res.status(400).render('form', {
      errors,
      formData: formData as Partial<FormSubmission>
    });
    return;
  }
  
  // Save to database
  db.insertSubmission(formData as FormSubmission);
  
  // Redirect to thank-you page
  res.redirect(302, '/thank-you');
});

app.get('/thank-you', (req: Request, res: Response) => {
  // Get the most recent submission to personalize the thank you message
  const submissions = db.getAllSubmissions();
  const latestSubmission = submissions[0];
  
  res.render('thank-you', { 
    firstName: latestSubmission?.first_name || 'Friend' 
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).render('form', {
    errors: { general: 'An unexpected error occurred. Please try again.' },
    formData: {} as Partial<FormSubmission>
  });
});

// Graceful shutdown
let server: ReturnType<typeof app.listen>;

async function startServer(): Promise<void> {
  try {
    await db.initialize();
    server = app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function gracefulShutdown(): Promise<void> {
  console.log('Shutting down gracefully...');
  
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
      db.close();
      process.exit(0);
    });
  } else {
    db.close();
    process.exit(0);
  }
}

// Handle termination signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start the server
startServer();
