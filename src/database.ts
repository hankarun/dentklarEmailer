import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

// Define types
export interface Template {
  id?: number;
  name: string;
  subject: string;
  body: string;
  is_default: number;
  created_at?: string;
  updated_at?: string;
}

export interface EmailHistory {
  id?: number;
  template_id: number | null;
  recipient_name: string;
  recipient_email: string;
  subject: string;
  message: string;
  pdf_filename: string | null;
  pdf_data: Buffer | null;
  status: string;
  error_message: string | null;
  sent_at?: string;
}

let db: Database.Database | null = null;

// Get database path in user data directory
function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'app-data.db');
}

// Initialize database connection and create tables
export function initDatabase(): Database.Database {
  if (db) return db;

  const dbPath = getDbPath();
  console.log('Database path:', dbPath);

  // Ensure the directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  
  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    -- Templates table
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      subject TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Email history table
    CREATE TABLE IF NOT EXISTS email_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER,
      recipient_name TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      pdf_filename TEXT,
      pdf_data BLOB,
      status TEXT NOT NULL DEFAULT 'sent',
      error_message TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
    );

    -- Create index for faster queries
    CREATE INDEX IF NOT EXISTS idx_email_history_sent_at ON email_history(sent_at);
    CREATE INDEX IF NOT EXISTS idx_templates_is_default ON templates(is_default);
  `);

  // Insert default template if no templates exist
  const templateCount = db.prepare('SELECT COUNT(*) as count FROM templates').get() as { count: number };
  if (templateCount.count === 0) {
    insertDefaultTemplate(db);
  }

  return db;
}

// Insert the default invoice template
function insertDefaultTemplate(database: Database.Database): void {
  const defaultTemplate = {
    name: 'Rechnung (Standard)',
    subject: 'Ihre Rechnung - Zahnarztpraxis ZÄ Turan & Kaganaslan',
    body: `Sehr geehrte{{ANREDE_SUFFIX}} {{ANREDE}} {{NAME}},

anbei erhalten Sie Ihre Rechnung für die zahnärztliche Behandlung in unserer Praxis.

Bitte überweisen Sie den Rechnungsbetrag innerhalb von 14 Tagen auf das in der Rechnung angegebene Konto.

Bei Fragen zu Ihrer Rechnung stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
Ihre Zahnarztpraxis
ZÄ Turan & Kaganaslan`,
    is_default: 1
  };

  database.prepare(`
    INSERT INTO templates (name, subject, body, is_default)
    VALUES (@name, @subject, @body, @is_default)
  `).run(defaultTemplate);
}

// Get database instance
export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

// Close database connection
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Template CRUD operations
export const templateOperations = {
  getAll(): Template[] {
    const database = getDatabase();
    return database.prepare('SELECT * FROM templates ORDER BY is_default DESC, name ASC').all() as Template[];
  },

  getById(id: number): Template | undefined {
    const database = getDatabase();
    return database.prepare('SELECT * FROM templates WHERE id = ?').get(id) as Template | undefined;
  },

  getDefault(): Template | undefined {
    const database = getDatabase();
    return database.prepare('SELECT * FROM templates WHERE is_default = 1').get() as Template | undefined;
  },

  create(template: Omit<Template, 'id' | 'created_at' | 'updated_at'>): Template {
    const database = getDatabase();
    
    // If this template is set as default, unset other defaults
    if (template.is_default) {
      database.prepare('UPDATE templates SET is_default = 0').run();
    }

    const result = database.prepare(`
      INSERT INTO templates (name, subject, body, is_default)
      VALUES (@name, @subject, @body, @is_default)
    `).run(template);

    return this.getById(result.lastInsertRowid as number)!;
  },

  update(id: number, template: Partial<Omit<Template, 'id' | 'created_at' | 'updated_at'>>): Template | undefined {
    const database = getDatabase();
    
    // If this template is set as default, unset other defaults
    if (template.is_default) {
      database.prepare('UPDATE templates SET is_default = 0 WHERE id != ?').run(id);
    }

    const existing = this.getById(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...template };
    
    database.prepare(`
      UPDATE templates 
      SET name = @name, subject = @subject, body = @body, is_default = @is_default, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({ ...updated, id });

    return this.getById(id);
  },

  delete(id: number): boolean {
    const database = getDatabase();
    const result = database.prepare('DELETE FROM templates WHERE id = ?').run(id);
    return result.changes > 0;
  },

  setDefault(id: number): boolean {
    const database = getDatabase();
    database.prepare('UPDATE templates SET is_default = 0').run();
    const result = database.prepare('UPDATE templates SET is_default = 1 WHERE id = ?').run(id);
    return result.changes > 0;
  }
};

// Email history operations
export const emailHistoryOperations = {
  getAll(limit: number = 100, offset: number = 0): EmailHistory[] {
    const database = getDatabase();
    return database.prepare(`
      SELECT id, template_id, recipient_name, recipient_email, subject, message, 
             pdf_filename, status, error_message, sent_at
      FROM email_history 
      ORDER BY sent_at DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset) as EmailHistory[];
  },

  getById(id: number): EmailHistory | undefined {
    const database = getDatabase();
    return database.prepare('SELECT * FROM email_history WHERE id = ?').get(id) as EmailHistory | undefined;
  },

  create(email: Omit<EmailHistory, 'id' | 'sent_at'>): EmailHistory {
    const database = getDatabase();
    
    const result = database.prepare(`
      INSERT INTO email_history (template_id, recipient_name, recipient_email, subject, message, pdf_filename, pdf_data, status, error_message)
      VALUES (@template_id, @recipient_name, @recipient_email, @subject, @message, @pdf_filename, @pdf_data, @status, @error_message)
    `).run(email);

    return this.getById(result.lastInsertRowid as number)!;
  },

  search(query: string, limit: number = 50): EmailHistory[] {
    const database = getDatabase();
    const searchPattern = `%${query}%`;
    return database.prepare(`
      SELECT id, template_id, recipient_name, recipient_email, subject, message, 
             pdf_filename, status, error_message, sent_at
      FROM email_history 
      WHERE recipient_name LIKE ? OR recipient_email LIKE ? OR subject LIKE ?
      ORDER BY sent_at DESC 
      LIMIT ?
    `).all(searchPattern, searchPattern, searchPattern, limit) as EmailHistory[];
  },

  getStats(): { total: number; successful: number; failed: number } {
    const database = getDatabase();
    const stats = database.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM email_history
    `).get() as { total: number; successful: number; failed: number };
    return stats;
  },

  delete(id: number): boolean {
    const database = getDatabase();
    const result = database.prepare('DELETE FROM email_history WHERE id = ?').run(id);
    return result.changes > 0;
  }
};
