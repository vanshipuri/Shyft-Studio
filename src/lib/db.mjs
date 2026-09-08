import Database from "better-sqlite3";
import { existsSync } from "fs";
import { join } from "path";

const DB_PATH = process.env.DB_PATH || join(process.cwd(), "db.sqlite");

function initDB() {
  const db = new Database(DB_PATH);
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('OWNER','SALES','PRODUCTION')),
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company TEXT,
      phone TEXT,
      email TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      stage TEXT NOT NULL DEFAULT 'ENQUIRY',
      assigned_to INTEGER,
      customer_id INTEGER NOT NULL,
      quote_amount REAL,
      due_date DATETIME,
      paid_upfront INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'normal',
      notes TEXT,
      is_late INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_stage ON jobs(stage);
    CREATE INDEX IF NOT EXISTS idx_jobs_assigned ON jobs(assigned_to);

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      customer_id INTEGER,
      job_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_notes_customer ON notes(customer_id);
    CREATE INDEX IF NOT EXISTS idx_notes_job ON notes(job_id);

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      by_user_id INTEGER NOT NULL,
      job_id INTEGER,
      customer_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (by_user_id) REFERENCES users(id),
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_activities_job ON activities(job_id);
    CREATE INDEX IF NOT EXISTS idx_activities_customer ON activities(customer_id);
  `);
  db.exec(`CREATE TRIGGER IF NOT EXISTS trg_jobs_updated_at AFTER UPDATE ON jobs BEGIN UPDATE jobs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;`);
  return db;
}

export const db = initDB();

// Helpers
export function getUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
}

export function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

export function getAllUsers() {
  return db.prepare("SELECT * FROM users").all();
}

export function getCustomers() {
  return db.prepare("SELECT * FROM customers ORDER BY name ASC").all();
}

export function getCustomerById(id) {
  return db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
}

export function getJobs(filters) {
  let sql = "SELECT * FROM jobs WHERE 1=1";
  const params = [];
  if (filters?.stage) { sql += " AND stage = ?"; params.push(filters.stage); }
  if (filters?.assignedTo) { sql += " AND assigned_to = ?"; params.push(filters.assignedTo); }
  if (filters?.customerId) { sql += " AND customer_id = ?"; params.push(filters.customerId); }
  sql += " ORDER BY updated_at DESC";
  return db.prepare(sql).all(...params);
}

export function getJobById(id) {
  return db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
}

export function getNotesForCustomer(customerId) {
  return db.prepare("SELECT n.*, u.name as author_name FROM notes n JOIN users u ON n.created_by = u.id WHERE n.customer_id = ? ORDER BY n.created_at DESC").all(customerId);
}

export function getNotesForJob(jobId) {
  return db.prepare("SELECT n.*, u.name as author_name FROM notes n JOIN users u ON n.created_by = u.id WHERE n.job_id = ? ORDER BY n.created_at DESC").all(jobId);
}

export function getActivitiesForJob(jobId) {
  return db.prepare("SELECT a.*, u.name as user_name FROM activities a JOIN users u ON a.by_user_id = u.id WHERE a.job_id = ? ORDER BY a.created_at DESC").all(jobId);
}

export function getCustomerJobs(customerId) {
  return db.prepare("SELECT j.*, c.name as customer_name FROM jobs j JOIN customers c ON j.customer_id = c.id WHERE j.customer_id = ? ORDER BY j.created_at DESC").all(customerId);
}

export function createJob(data) {
  const stmt = db.prepare(`
    INSERT INTO jobs (title, description, stage, assigned_to, customer_id, quote_amount, due_date, priority, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const res = stmt.run(
    data.title, data.description || "", data.stage || "ENQUIRY", data.assignedTo || null,
    data.customerId, data.quoteAmount || null, data.dueDate || null, data.priority || "normal", data.notes || ""
  );
  return res.lastInsertRowid;
}

export function updateJob(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const set = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => fields[k]);
  db.prepare(`UPDATE jobs SET ${set} WHERE id = ?`).run(...values, id);
}

export function addNote(data) {
  const stmt = db.prepare("INSERT INTO notes (content, created_by, customer_id, job_id) VALUES (?, ?, ?, ?)");
  const res = stmt.run(data.content, data.createdBy, data.customerId || null, data.jobId || null);
  return res.lastInsertRowid;
}

export function addActivity(data) {
  const stmt = db.prepare("INSERT INTO activities (description, by_user_id, job_id, customer_id) VALUES (?, ?, ?, ?)");
  const res = stmt.run(data.description, data.byUserId, data.jobId || null, data.customerId || null);
  return res.lastInsertRowid;
}

export function getLateJobs() {
  return db.prepare("SELECT j.*, c.name as customer_name FROM jobs j JOIN customers c ON j.customer_id = c.id WHERE j.is_late = 1 OR (j.due_date < CURRENT_TIMESTAMP AND j.stage != 'DELIVERED') ORDER BY j.due_date ASC").all();
}

export function getStageCounts() {
  return db.prepare("SELECT stage, COUNT(*) as count FROM jobs GROUP BY stage").all();
}
