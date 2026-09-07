const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(process.cwd(), "db.sqlite"));
db.exec(`PRAGMA foreign_keys = ON;`);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
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

function getUser(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
}

function getCustomerId(name) {
  const r = db.prepare("SELECT id FROM customers WHERE name = ?").get(name);
  return r ? r.id : null;
}

function createCustomer(name, company, phone, email, notes) {
  const stmt = db.prepare("INSERT INTO customers (name, company, phone, email, notes) VALUES (?, ?, ?, ?, ?)");
  const res = stmt.run(name, company || null, phone || null, email || null, notes || null);
  return res.lastInsertRowid;
}

function createJob(data) {
  const stmt = db.prepare(`
    INSERT INTO jobs (title, description, stage, assigned_to, customer_id, quote_amount, due_date, priority, notes, is_late)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const res = stmt.run(
    data.title, data.description || "", data.stage || "ENQUIRY", data.assignedTo || null,
    data.customerId, data.quoteAmount || null, data.dueDate || null, data.priority || "normal", data.notes || "", data.isLate ? 1 : 0
  );
  return res.lastInsertRowid;
}

// Users
const users = db.prepare("SELECT * FROM users").all();
if (users.length === 0) {
  const insertUser = db.prepare("INSERT INTO users (name, email, role, password) VALUES (?, ?, ?, ?)");
  insertUser.run("Samyak Mehta", "samyak@shyft.studio", "OWNER", "password123");
  insertUser.run("Abhishek Rao", "abhishek@shyft.studio", "SALES", "password123");
  insertUser.run("Siddhant Yadav", "siddhant@shyft.studio", "PRODUCTION", "password123");
}

const samyak = getUser("samyak@shyft.studio");
const abhishek = getUser("abhishek@shyft.studio");
const siddhant = getUser("siddhant@shyft.studio");

// Customers
const brightId = createCustomer("Neha Desai", "BrightTech Solutions", "+91 98765 43210", "neha@brighttech.in", "Regular brochure & card client. Prefers matte 300gsm, glossy only on covers. Last order 2 weeks ago.");
const cityId = createCustomer("Rahul Verma", "City Events Pvt Ltd", "+91 99887 77665", "rahul@cityevents.co", "Event brochures & visiting cards. Usually needs quick turnaround (3-4 days).");
const messyId = createCustomer("Priya Nair", null, "+91 91234 56789", "priya@unknown.in", "Called from a different number. Said 'brochures for a conference' but unclear quantity, paper, and deadline.");
const longId = createCustomer("Anjali Kapoor", "Vihaan Interiors", "+91 95678 12345", "anjali@vihaan.in", "Large-format posters, brochures, visiting cards. Repeat every 6-8 weeks.");
const lateCustId = createCustomer("Karan Singh", "Singh & Sons", "+91 88776 55443", "karan@singhsons.in", "Urgent order for visiting cards delivered to client. Originally due Monday but design delays pushed it.");

// Jobs
createJob({ title: "Brochures + Visiting Cards — Q3", description: "500 visiting cards (matte, 300gsm) and 50 brochures (A4 tri-fold, glossy cover / matte inner). Design provided.", stage: "DELIVERED", assignedTo: siddhant ? siddhant.id : null, customerId: brightId, quoteAmount: 12800, dueDate: "2026-09-05T00:00:00Z", priority: "normal", notes: "Paid 50% upfront. Client approved design on 1st Sep. Printed 3rd Sep." });

createJob({ title: "Repeat — 500 cards + brochures (Sep)", description: "Client called asking for 'same as last time' — 500 visiting cards, 50 brochures, matte/glossy mix.", stage: "QUOTED", assignedTo: abhishek ? abhishek.id : null, customerId: brightId, quoteAmount: 12600, dueDate: "2026-09-15T00:00:00Z", priority: "high", notes: "Repeat of previous job. Need to confirm paper stock." });

createJob({ title: "Event Brochures — Diwali Meet", description: "2,000 A5 brochures for Diwali corporate event. Client has draft in Word; needs design help.", stage: "DESIGN", assignedTo: abhishek ? abhishek.id : null, customerId: cityId, quoteAmount: 24500, dueDate: "2026-09-10T00:00:00Z", priority: "urgent", notes: "Design draft due 6th Sep. Gold foil requested." });

createJob({ title: "Visiting Cards — Q2", description: "300 cards, standard glossy. Design in-house.", stage: "DELIVERED", assignedTo: siddhant ? siddhant.id : null, customerId: cityId, quoteAmount: 4200, dueDate: "2026-08-20T00:00:00Z", priority: "normal", notes: "Completed 18 Aug." });

createJob({ title: "Brochure Enquiry — Unconfirmed", description: "Called from unknown number. Said 'brochures for a conference'. Unclear quantity, size, or deadline.", stage: "ENQUIRY", assignedTo: abhishek ? abhishek.id : null, customerId: messyId, quoteAmount: null, dueDate: null, priority: "low", notes: "Follow up urgently — no response to first call." });

createJob({ title: "Posters + Cards — Vihaan Interiors", description: "12 large posters (A1, laminated) and 200 visiting cards (matte, embossed logo). Design provided; needs proof.", stage: "PRINTING", assignedTo: siddhant ? siddhant.id : null, customerId: longId, quoteAmount: 18500, dueDate: "2026-09-08T00:00:00Z", priority: "high", notes: "Color proof approved 5th Sep. Late risk due to lamination machine." });

createJob({ title: "Visiting Cards — Client Delivery", description: "500 premium cards with foil stamping. Design approved 3rd Sep.", stage: "PRINTING", assignedTo: siddhant ? siddhant.id : null, customerId: lateCustId, quoteAmount: 15600, dueDate: "2026-09-06T00:00:00Z", priority: "urgent", notes: "LATE — printing delayed by paper stock. Customer called yesterday.", isLate: 1 });

createJob({ title: "Brochure Set — Corporate Launch", description: "100 tri-fold brochures for new product launch.", stage: "QUOTED", assignedTo: abhishek ? abhishek.id : null, customerId: brightId, quoteAmount: 7800, dueDate: "2026-09-20T00:00:00Z", priority: "normal", notes: "New client referred by BrightTech." });

createJob({ title: "Visiting Cards — Small Batch", description: "50 cards, quick turnaround.", stage: "READY", assignedTo: siddhant ? siddhant.id : null, customerId: longId, quoteAmount: 980, dueDate: "2026-09-09T00:00:00Z", priority: "low", notes: "Ready for pickup." });

console.log("Seed complete.");
