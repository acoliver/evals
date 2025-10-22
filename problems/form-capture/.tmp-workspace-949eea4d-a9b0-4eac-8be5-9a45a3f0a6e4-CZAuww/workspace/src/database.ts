import * as fs from 'node:fs';
import * as path from 'node:path';
import { createDb } from 'sql.js';
import type { Database } from 'sql.js';
import { FormSubmission, DatabaseSubmission } from './types.js';

const DB_PATH = path.join(process.cwd(), 'data', 'submissions.sqlite');
const SCHEMA_PATH = path.join(process.cwd(), 'db', 'schema.sql');

class DatabaseService {
  private db: Database | null = null;

  async initialize(): Promise<void> {
    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Load or create database
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      const SQL = await createDb();
      this.db = new SQL.Database(buffer);
    } else {
      const SQL = await createDb();
      this.db = new SQL.Database();
      
      // Create schema
      const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
      this.db.exec(schema);
      this.saveDatabase();
    }
  }

  private saveDatabase(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const data = this.db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }

  insertSubmission(submission: FormSubmission): DatabaseSubmission {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare(`
      INSERT INTO submissions (
        first_name, last_name, street_address, city, 
        state_province, postal_code, country, email, phone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      submission.first_name,
      submission.last_name,
      submission.street_address,
      submission.city,
      submission.state_province,
      submission.postal_code,
      submission.country,
      submission.email,
      submission.phone
    ]);

    stmt.free();

    // Get the inserted record with ID and timestamp
    const lastId = this.db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
    const rows = this.db.exec('SELECT * FROM submissions WHERE id = ?')[0].values[0];
    
    const insertedRecord: DatabaseSubmission = {
      id: rows[0] as number,
      first_name: rows[1] as string,
      last_name: rows[2] as string,
      street_address: rows[3] as string,
      city: rows[4] as string,
      state_province: rows[5] as string,
      postal_code: rows[6] as string,
      country: rows[7] as string,
      email: rows[8] as string,
      phone: rows[9] as string,
      created_at: rows[10] as string,
    };

    this.saveDatabase();
    return insertedRecord;
  }

  getAllSubmissions(): DatabaseSubmission[] {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = this.db.exec('SELECT * FROM submissions ORDER BY created_at DESC');
      if (result.length === 0) return [];

      return result[0].values.map(row => ({
        id: row[0] as number,
        first_name: row[1] as string,
        last_name: row[2] as string,
        street_address: row[3] as string,
        city: row[4] as string,
        state_province: row[5] as string,
        postal_code: row[6] as string,
        country: row[7] as string,
        email: row[8] as string,
        phone: row[9] as string,
        created_at: row[10] as string,
      }));
    } catch (error) {
      // Table might not exist yet
      return [];
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const db = new DatabaseService();