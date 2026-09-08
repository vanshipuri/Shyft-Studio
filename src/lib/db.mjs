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

  // Safe schema enhancements
  try {
    const jobColumns = db.prepare("PRAGMA table_info(jobs)").all().map(c => c.name);
    if (!jobColumns.includes("checklist")) {
      db.exec("ALTER TABLE jobs ADD COLUMN checklist TEXT;");
    }
    if (!jobColumns.includes("lead_source")) {
      db.exec("ALTER TABLE jobs ADD COLUMN lead_source TEXT DEFAULT 'Direct';");
    }
    if (!jobColumns.includes("specs_summary")) {
      db.exec("ALTER TABLE jobs ADD COLUMN specs_summary TEXT;");
    }
    if (!jobColumns.includes("risk_score")) {
      db.exec("ALTER TABLE jobs ADD COLUMN risk_score TEXT DEFAULT 'LOW';");
    }
    if (!jobColumns.includes("risk_reason")) {
      db.exec("ALTER TABLE jobs ADD COLUMN risk_reason TEXT;");
    }
  } catch (err) {
    // Column might already exist
  }

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

export function createCustomer(data) {
  const stmt = db.prepare("INSERT INTO customers (name, company, phone, email, notes) VALUES (?, ?, ?, ?, ?)");
  const res = stmt.run(data.name, data.company || null, data.phone || null, data.email || null, data.notes || null);
  return res.lastInsertRowid;
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
    INSERT INTO jobs (title, description, stage, assigned_to, customer_id, quote_amount, due_date, priority, notes, is_late, lead_source, specs_summary, checklist, risk_score, risk_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const res = stmt.run(
    data.title,
    data.description || "",
    data.stage || "ENQUIRY",
    data.assignedTo || null,
    data.customerId,
    data.quoteAmount || null,
    data.dueDate || null,
    data.priority || "normal",
    data.notes || "",
    data.isLate ? 1 : 0,
    data.leadSource || "Direct",
    data.specsSummary || null,
    data.checklist || null,
    data.riskScore || "LOW",
    data.riskReason || null
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

export function getDefaultChecklist(stage, title = "", description = "") {
  const stageOrder = ["ENQUIRY", "QUOTED", "DESIGN", "PRINTING", "READY", "DELIVERED"];
  const stageIdx = stageOrder.indexOf(stage);

  return [
    { id: "art", label: "Vector Artwork & High-Res PDF Verified", done: stageIdx >= 2 },
    { id: "stock", label: "Paper Stock Reserved (300gsm / Glossy / Matte)", done: stageIdx >= 3 },
    { id: "proof", label: "Digital Proof Signed Off by Client", done: stageIdx >= 3 },
    { id: "print", label: "Offset / Digital Print Run Completed", done: stageIdx >= 4 },
    { id: "finish", label: "Lamination, Die-cut & Creasing Finished", done: stageIdx >= 4 },
    { id: "qc", label: "Final Quality Check & Bundled for Delivery", done: stageIdx >= 5 },
  ];
}

export function getJobChecklist(job) {
  if (job.checklist) {
    try {
      return JSON.parse(job.checklist);
    } catch {
      // fallback
    }
  }
  return getDefaultChecklist(job.stage, job.title, job.description);
}

export function getPipelineMetrics() {
  const allJobs = getJobs();
  const activeJobs = allJobs.filter(j => j.stage !== "DELIVERED");
  const deliveredJobs = allJobs.filter(j => j.stage === "DELIVERED");
  const lateJobs = getLateJobs();

  const pipelineValue = activeJobs.reduce((sum, j) => sum + (j.quote_amount || 0), 0);
  const realizedRevenue = deliveredJobs.reduce((sum, j) => sum + (j.quote_amount || 0), 0);
  const lateRevenue = lateJobs.reduce((sum, j) => sum + (j.quote_amount || 0), 0);
  const quotedValue = allJobs.filter(j => j.stage === "QUOTED").reduce((sum, j) => sum + (j.quote_amount || 0), 0);

  const stageRevenue = {
    ENQUIRY: allJobs.filter(j => j.stage === "ENQUIRY").reduce((s, j) => s + (j.quote_amount || 0), 0),
    QUOTED: quotedValue,
    DESIGN: allJobs.filter(j => j.stage === "DESIGN").reduce((s, j) => s + (j.quote_amount || 0), 0),
    PRINTING: allJobs.filter(j => j.stage === "PRINTING").reduce((s, j) => s + (j.quote_amount || 0), 0),
    READY: allJobs.filter(j => j.stage === "READY").reduce((s, j) => s + (j.quote_amount || 0), 0),
    DELIVERED: realizedRevenue,
  };

  return {
    totalJobsCount: allJobs.length,
    activeJobsCount: activeJobs.length,
    deliveredJobsCount: deliveredJobs.length,
    lateJobsCount: lateJobs.length,
    pipelineValue,
    realizedRevenue,
    lateRevenue,
    quotedValue,
    averageTicketSize: activeJobs.length > 0 ? Math.round(pipelineValue / activeJobs.length) : 0,
    stageRevenue,
  };
}

export function getTeamWorkload() {
  const users = getAllUsers();
  const allJobs = getJobs();

  return users.map(user => {
    const assignedJobs = allJobs.filter(j => j.assigned_to === user.id && j.stage !== "DELIVERED");
    const activeValue = assignedJobs.reduce((s, j) => s + (j.quote_amount || 0), 0);
    const lateCount = assignedJobs.filter(j => j.is_late || (j.due_date && new Date(j.due_date) < new Date())).length;

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      activeJobsCount: assignedJobs.length,
      activeValue,
      lateCount,
      stages: {
        enquiry: assignedJobs.filter(j => j.stage === "ENQUIRY").length,
        quoted: assignedJobs.filter(j => j.stage === "QUOTED").length,
        design: assignedJobs.filter(j => j.stage === "DESIGN").length,
        printing: assignedJobs.filter(j => j.stage === "PRINTING").length,
        ready: assignedJobs.filter(j => j.stage === "READY").length,
      }
    };
  });
}

export function getCustomerMetrics(customerId) {
  const jobs = getCustomerJobs(customerId);
  const totalSpend = jobs.reduce((s, j) => s + (j.quote_amount || 0), 0);
  const delivered = jobs.filter(j => j.stage === "DELIVERED");
  const repeatCount = jobs.length;
  const isRepeat = repeatCount > 1;

  return {
    totalOrders: jobs.length,
    deliveredOrders: delivered.length,
    totalSpend,
    averageOrderValue: jobs.length > 0 ? Math.round(totalSpend / jobs.length) : 0,
    isRepeat,
    lastOrder: jobs[0] || null
  };
}
