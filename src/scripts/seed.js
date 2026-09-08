// Shyft Studio seed — 3 users, 12 customers, ~27 jobs with multi-month order history.
//
// Run against a FRESH database only (delete db.sqlite first):
//   rm -f db.sqlite && npm run db:seed
//
// Dates are generated relative to "now" so the demo stays coherent whenever it is
// re-seeded: a handful of jobs are intentionally late / at-risk, several customers
// have realistic repeat cadences (including two overdue for a re-order check-in),
// and every stage has exactly one owner derived from the pipeline definition.

const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(process.cwd(), "db.sqlite"));
db.exec(`PRAGMA foreign_keys = ON;`);

const DAY = 86400000;
/** ISO date `n` days from today (negative = past). */
function daysFromNow(n, hour = 9) {
  const d = new Date(Date.now() + n * DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

db.exec(`
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
  lead_source TEXT DEFAULT 'Direct',
  specs_summary TEXT,
  checklist TEXT,
  risk_score TEXT DEFAULT 'LOW',
  risk_reason TEXT,
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

// ---------------------------------------------------------------------------
// Users (id 1..3)
// ---------------------------------------------------------------------------
function getUser(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
}

const existingUsers = db.prepare("SELECT * FROM users").all();
if (existingUsers.length === 0) {
  const insertUser = db.prepare("INSERT INTO users (name, email, role, password) VALUES (?, ?, ?, ?)");
  insertUser.run("Samyak Mehta", "samyak@shyft.studio", "OWNER", "password123");
  insertUser.run("Abhishek Rao", "abhishek@shyft.studio", "SALES", "password123");
  insertUser.run("Siddhant Yadav", "siddhant@shyft.studio", "PRODUCTION", "password123");
}

const samyak = getUser("samyak@shyft.studio");
const abhishek = getUser("abhishek@shyft.studio");
const siddhant = getUser("siddhant@shyft.studio");

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
    INSERT INTO jobs (title, description, stage, assigned_to, customer_id, quote_amount, due_date, paid_upfront, priority, notes, is_late, created_at, updated_at, lead_source, specs_summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const res = stmt.run(
    data.title,
    data.description || "",
    data.stage || "ENQUIRY",
    data.assignedTo,
    data.customerId,
    data.quoteAmount || null,
    data.dueDate || null,
    data.paidUpfront ? 1 : 0,
    data.priority || "normal",
    data.notes || "",
    data.isLate ? 1 : 0,
    data.createdAt || daysFromNow(0, 6),
    data.updatedAt || data.createdAt || daysFromNow(0, 6),
    data.leadSource || "Direct",
    data.specsSummary || null
  );
  return res.lastInsertRowid;
}

function addNote(content, userId, customerId, jobId, daysAgo) {
  db.prepare(
    "INSERT INTO notes (content, created_by, customer_id, job_id, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(content, userId, customerId || null, jobId || null, daysFromNow(-daysAgo, 10));
}

function addActivity(description, userId, jobId, customerId, daysAgo) {
  db.prepare(
    "INSERT INTO activities (description, by_user_id, job_id, customer_id, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(description, userId, jobId || null, customerId || null, daysFromNow(-daysAgo, 11));
}

// ---------------------------------------------------------------------------
// Customers (id 1..12)
// ---------------------------------------------------------------------------
const brightId = createCustomer("Neha Desai", "BrightTech Solutions", "+91 98765 43210", "neha@brighttech.in", "Regular brochure & visiting-card client. Prefers 300gsm matte for cards, gloss only on brochure covers. Approves proofs same day when pinged on WhatsApp.");
const cityId = createCustomer("Rahul Verma", "City Events Pvt Ltd", "+91 99887 77665", "rahul@cityevents.co", "Event brochures, backdrop & gifting kits. Needs 4–5 day turnarounds before events; books several times a quarter.");
const messyId = createCustomer("Priya Nair", null, "+91 91234 56789", "priya@unknown.in", "Called from a different number. Said 'brochures for a conference' but quantity, paper, and deadline are still unclear.");
const vihaanId = createCustomer("Anjali Kapoor", "Vihaan Interiors", "+91 95678 12345", "anjali@vihaan.in", "Large-format posters, brochures, visiting cards. Reorders every 6–8 weeks around showroom launches.");
const singhId = createCustomer("Karan Singh", "Singh & Sons", "+91 88776 55443", "karan@singhsons.in", "Urgent premium visiting-card orders. Sensitive to delays — orders for client distribution events.");
const urbanId = createCustomer("Meera Shah", "Urban Nest", "+91 90909 80807", "meera@urbannest.in", "Café + home-store chain. Was ordering every ~6 weeks (menu cards, flyers, packaging labels) — silent for months, worth a check-in.");
const joshiId = createCustomer("Vikram Joshi", "Joshi & Co", "+91 98111 22233", "vikram@joshi.co", "Corporate stationery & annual-report packs. Single large annual engagement.");
const reddyId = createCustomer("Sneha Reddy", "Reddy Events", "+91 97000 12321", "sneha@reddyevents.in", "Conference & wedding stationery. Books 4–6 weeks before each event.");
const grandId = createCustomer("Arjun Mehta", "Grandline Hotels", "+91 96999 88776", "arjun@grandline.in", "In-room stationery, menus, table tents across properties. Reorders roughly every 2 months.");
const kayraId = createCustomer("Farhan Ali", "Kayra Fitness", "+91 95888 77665", "farhan@kayra.in", "Gym membership cards, booklets, launch banners. Newer account, ramping up quickly.");
const aromaId = createCustomer("Deepa Iyer", "Aroma Luxe", "+91 91222 33445", "deepa@aromaluxe.in", "Retail label stickers for candle & bath products. Small but frequent batches.");
const guptaId = createCustomer("Rohan Gupta", "Gupta Traders", "+91 98700 11223", "rohan@guptatraders.in", "Rate cards & envelopes for the trading business. One-off engagement so far.");

// Owner/role constants: every stage has a single canonical owner (Sales for
// intake → design and post-delivery; Production for the print floor).
const sales = abhishek.id;      // ENQUIRY / QUOTED / DESIGN / DELIVERED follow-up
const ops = siddhant.id;        // PRINTING / READY

// ---------------------------------------------------------------------------
// Jobs 1–9 — the original demo spine (kept byte-for-byte where tests depend)
// ---------------------------------------------------------------------------
// 1. BrightTech — delivered flagship job (used by the repeat-order demo/tests)
createJob({
  title: "Brochures + Visiting Cards — Q3",
  description: "500 visiting cards (matte, 300gsm) and 50 brochures (A4 tri-fold, glossy cover / matte inner). Design provided.",
  stage: "DELIVERED", assignedTo: sales, customerId: brightId, quoteAmount: 12800,
  dueDate: daysFromNow(-3), paidUpfront: 1, priority: "normal",
  notes: "Paid 50% upfront. Client approved design on 1st Sep. Printed 3rd Sep, delivered 5th Sep.",
  createdAt: daysFromNow(-40, 9), updatedAt: daysFromNow(-3, 18),
  leadSource: "Direct", specsSummary: "500 Visiting Cards (300gsm Matte) + 50 Brochures (A4 Tri-fold, Gloss Cover / Matte Inner)"
});
// 2. BrightTech — repeat order sitting in QUOTED (sales must confirm)
createJob({
  title: "Repeat — 500 cards + brochures (Sep)",
  description: "Client called asking for 'same as last time' — 500 visiting cards, 50 brochures, matte/glossy mix.",
  stage: "QUOTED", assignedTo: sales, customerId: brightId, quoteAmount: 12600,
  dueDate: daysFromNow(7), paidUpfront: 0, priority: "high",
  notes: "Repeat of previous job. Need to confirm paper stock before triggering print run.",
  createdAt: daysFromNow(-3, 12), updatedAt: daysFromNow(-1, 9),
  leadSource: "Repeat Client", specsSummary: "500 Visiting Cards (300gsm Matte) + 50 Brochures (A4 Tri-fold) — same as last run"
});
// 3. City Events — urgent design sign-off
createJob({
  title: "Event Brochures — Diwali Meet",
  description: "2,000 A5 brochures for Diwali corporate event. Client has draft in Word; needs design help.",
  stage: "DESIGN", assignedTo: sales, customerId: cityId, quoteAmount: 24500,
  dueDate: daysFromNow(2), paidUpfront: 0, priority: "urgent",
  notes: "Gold foil cover requested. Digital proof with client — sign-off gates the print start.",
  createdAt: daysFromNow(-6, 9), updatedAt: daysFromNow(-1, 14),
  leadSource: "WhatsApp / Chat", specsSummary: "2000 Brochures (A5 4-Page, Gold Foil Cover)"
});
// 4. City Events — earlier delivered order (gives repeat history)
createJob({
  title: "Visiting Cards — Q2",
  description: "300 cards, standard glossy. Design in-house.",
  stage: "DELIVERED", assignedTo: sales, customerId: cityId, quoteAmount: 4200,
  dueDate: daysFromNow(-19), paidUpfront: 1, priority: "normal",
  notes: "Completed 18 Aug, collected from workshop.",
  createdAt: daysFromNow(-45, 9), updatedAt: daysFromNow(-19, 16),
  leadSource: "Direct", specsSummary: "300 Visiting Cards (Gloss Lamination)"
});
// 5. Priya Nair — aging unquoted enquiry (sales follow-up demo)
createJob({
  title: "Brochure Enquiry — Unconfirmed",
  description: "Called from unknown number. Said 'brochures for a conference'. Unclear quantity, size, or deadline.",
  stage: "ENQUIRY", assignedTo: sales, customerId: messyId, quoteAmount: null,
  dueDate: null, paidUpfront: 0, priority: "low",
  notes: "Follow up urgently — no response since the first call.",
  createdAt: daysFromNow(-8, 9), updatedAt: daysFromNow(-8, 9),
  leadSource: "Phone Call", specsSummary: "Brochures — specs unconfirmed"
});
// 6. Vihaan Interiors — on the floor, due tomorrow (HIGH risk demo)
createJob({
  title: "Posters + Cards — Vihaan Interiors",
  description: "12 large posters (A1, laminated) and 200 visiting cards (matte, embossed logo). Design provided; needs proof.",
  stage: "PRINTING", assignedTo: ops, customerId: vihaanId, quoteAmount: 18500,
  dueDate: daysFromNow(1), paidUpfront: 1, priority: "high",
  notes: "Color proof approved. Due tomorrow — A1 posters need matte thermal lamination, which is the gating step.",
  createdAt: daysFromNow(-14, 9), updatedAt: daysFromNow(-1, 8),
  leadSource: "Direct", specsSummary: "12 Posters (A1, Laminated) + 200 Visiting Cards (Matte, Embossed)"
});
// 7. Singh & Sons — deliberately LATE (risk + apology-draft demo)
createJob({
  title: "Visiting Cards — Client Delivery",
  description: "500 premium cards with foil stamping. Design approved.",
  stage: "PRINTING", assignedTo: ops, customerId: singhId, quoteAmount: 15600,
  dueDate: daysFromNow(-2), paidUpfront: 1, priority: "urgent", isLate: 1,
  notes: "LATE — printing delayed by paper stock. Customer called yesterday; needs an updated ETA.",
  createdAt: daysFromNow(-10, 9), updatedAt: daysFromNow(-1, 9),
  leadSource: "WhatsApp / Chat", specsSummary: "500 Visiting Cards (Premium, Gold Foil Stamping)"
});
// 8. BrightTech — second quoted job (referred corporate launch)
createJob({
  title: "Brochure Set — Corporate Launch",
  description: "100 tri-fold brochures for new product launch.",
  stage: "QUOTED", assignedTo: sales, customerId: brightId, quoteAmount: 7800,
  dueDate: daysFromNow(12), paidUpfront: 0, priority: "normal",
  notes: "New client referred by BrightTech.",
  createdAt: daysFromNow(-2, 10), updatedAt: daysFromNow(-1, 10),
  leadSource: "Referral", specsSummary: "100 Brochures (A4 Tri-fold)"
});
// 9. Vihaan — small batch READY for pickup
createJob({
  title: "Visiting Cards — Small Batch",
  description: "50 cards, quick turnaround.",
  stage: "READY", assignedTo: ops, customerId: vihaanId, quoteAmount: 980,
  dueDate: daysFromNow(1), paidUpfront: 1, priority: "low",
  notes: "Ready for pickup.",
  createdAt: daysFromNow(-4, 9), updatedAt: daysFromNow(-1, 15),
  leadSource: "Walk-in", specsSummary: "50 Visiting Cards (Standard)"
});

// ---------------------------------------------------------------------------
// Jobs 10+ — multi-month history + customers designed for the AI demos
// ---------------------------------------------------------------------------
// BrightTech older delivery (cadence: ~57 days → reorder window)
createJob({
  title: "Visiting Cards + Brochures — Q2 Refresh",
  description: "Same-as-last-time batch: 500 cards + 50 brochures for the Q2 product push.",
  stage: "DELIVERED", assignedTo: sales, customerId: brightId, quoteAmount: 11800,
  dueDate: daysFromNow(-62), paidUpfront: 1, priority: "normal",
  notes: "Completed on schedule.",
  createdAt: daysFromNow(-80, 9), updatedAt: daysFromNow(-60, 16),
  leadSource: "Repeat Client", specsSummary: "500 Visiting Cards (300gsm Matte) + 50 Brochures (A4 Tri-fold)"
});
// City Events older delivery
createJob({
  title: "Event Backdrop + Standee Set",
  description: "3m backdrop banner and 6 roll-up standees for the summer expo.",
  stage: "DELIVERED", assignedTo: sales, customerId: cityId, quoteAmount: 16200,
  dueDate: daysFromNow(-84), paidUpfront: 1, priority: "high",
  notes: "Installed at venue two days before the expo.",
  createdAt: daysFromNow(-108, 9), updatedAt: daysFromNow(-82, 17),
  leadSource: "Direct", specsSummary: "3m Backdrop + 6 Roll-up Standees (Large Format)"
});
// Vihaan older delivery
createJob({
  title: "Poster Set — Showroom Launch",
  description: "A2 posters and window decals for the new Vihaan showroom.",
  stage: "DELIVERED", assignedTo: sales, customerId: vihaanId, quoteAmount: 15400,
  dueDate: daysFromNow(-47), paidUpfront: 1, priority: "normal",
  notes: "Client collected after QC sign-off.",
  createdAt: daysFromNow(-72, 9), updatedAt: daysFromNow(-45, 16),
  leadSource: "Direct", specsSummary: "Posters (A2) + Window Decals (Large Format)"
});
// Urban Nest — dormant repeat customer (re-engagement HOT demo)
createJob({
  title: "Café Menu Cards + Flyers",
  description: "Menu cards and table flyers for the Indiranagar café relaunch.",
  stage: "DELIVERED", assignedTo: sales, customerId: urbanId, quoteAmount: 6200,
  dueDate: daysFromNow(-212), paidUpfront: 1, priority: "normal",
  notes: "Relaunch pack delivered early.",
  createdAt: daysFromNow(-218, 9), updatedAt: daysFromNow(-210, 15),
  leadSource: "Direct", specsSummary: "Menu Cards + Flyers"
});
createJob({
  title: "Packaging Labels — Product Line",
  description: "Sticker labels for the Urban Nest home-goods range.",
  stage: "DELIVERED", assignedTo: sales, customerId: urbanId, quoteAmount: 8400,
  dueDate: daysFromNow(-152), paidUpfront: 1, priority: "normal",
  notes: "Two proof rounds, then delivered.",
  createdAt: daysFromNow(-158, 9), updatedAt: daysFromNow(-150, 16),
  leadSource: "Repeat Client", specsSummary: "Packaging Labels (Custom Die-cut)"
});
createJob({
  title: "Seasonal Flyers — Monsoon Sale",
  description: "Large flyer run for the seasonal sale across three stores.",
  stage: "DELIVERED", assignedTo: sales, customerId: urbanId, quoteAmount: 2100,
  dueDate: daysFromNow(-122), paidUpfront: 0, priority: "low",
  notes: "Last order — nothing since. Overdue vs their ~6-week cadence.",
  createdAt: daysFromNow(-128, 9), updatedAt: daysFromNow(-120, 15),
  leadSource: "Repeat Client", specsSummary: "Flyers (Seasonal Sale)"
});
// Joshi & Co — one-off corporate client
createJob({
  title: "Annual Report Print Pack",
  description: "Annual report + corporate stationery for the AGM.",
  stage: "DELIVERED", assignedTo: sales, customerId: joshiId, quoteAmount: 28800,
  dueDate: daysFromNow(-47), paidUpfront: 1, priority: "high",
  notes: "Larger run — bound reports with slipcases.",
  createdAt: daysFromNow(-78, 9), updatedAt: daysFromNow(-45, 17),
  leadSource: "Referral", specsSummary: "Annual Reports (Bound) + Stationery"
});
// Reddy Events — repeat but INSIDE cadence (should NOT be nudged)
createJob({
  title: "Conference Kit — Delegate Folders",
  description: "300 delegate folders with inserts for the fintech summit.",
  stage: "DELIVERED", assignedTo: sales, customerId: reddyId, quoteAmount: 17400,
  dueDate: daysFromNow(-36), paidUpfront: 1, priority: "high",
  notes: "Inserts assembled on-site.",
  createdAt: daysFromNow(-58, 9), updatedAt: daysFromNow(-34, 16),
  leadSource: "Direct", specsSummary: "300 Delegate Folders + Inserts"
});
createJob({
  title: "Invitation + Banner Set",
  description: "Wedding invitation cards and banner for Reddy Events' client.",
  stage: "DELIVERED", assignedTo: sales, customerId: reddyId, quoteAmount: 9600,
  dueDate: daysFromNow(-87), paidUpfront: 1, priority: "normal",
  notes: "Premium textured card stock.",
  createdAt: daysFromNow(-96, 9), updatedAt: daysFromNow(-85, 16),
  leadSource: "Direct", specsSummary: "Invitations + Banner"
});
// Grandline Hotels — repeat, overdue for next property order
createJob({
  title: "In-room Stationery — New Wing",
  description: "Room menus, table tents and notepads for the new wing.",
  stage: "DELIVERED", assignedTo: sales, customerId: grandId, quoteAmount: 13200,
  dueDate: daysFromNow(-82), paidUpfront: 1, priority: "normal",
  notes: "Delivered to housekeeping.",
  createdAt: daysFromNow(-98, 9), updatedAt: daysFromNow(-80, 16),
  leadSource: "Repeat Client", specsSummary: "In-room Stationery (Room Menus / Table Tents)"
});
createJob({
  title: "Brochure Rack Set",
  description: "Brochures and rack cards for the lobby brochure stands.",
  stage: "DELIVERED", assignedTo: sales, customerId: grandId, quoteAmount: 19800,
  dueDate: daysFromNow(-142), paidUpfront: 1, priority: "normal",
  notes: "Two properties, bundled dispatch.",
  createdAt: daysFromNow(-156, 9), updatedAt: daysFromNow(-140, 16),
  leadSource: "Repeat Client", specsSummary: "Brochures + Rack Cards (2 Properties)"
});
// Kayra Fitness — has an OPEN job, so even with old deliveries it is NOT nudged
createJob({
  title: "Gym Cards + Membership Booklets",
  description: "New-member kits for the Whitefield launch.",
  stage: "PRINTING", assignedTo: ops, customerId: kayraId, quoteAmount: 9600,
  dueDate: daysFromNow(4), paidUpfront: 1, priority: "high",
  notes: "Printing started; booklet binding after lamination.",
  createdAt: daysFromNow(-5, 9), updatedAt: daysFromNow(-1, 10),
  leadSource: "Repeat Client", specsSummary: "Membership Cards + Booklets"
});
createJob({
  title: "New Member Kit",
  description: "Intro kit printed for the Koramangala studio.",
  stage: "DELIVERED", assignedTo: sales, customerId: kayraId, quoteAmount: 11800,
  dueDate: daysFromNow(-102), paidUpfront: 1, priority: "normal",
  notes: "Delivered.",
  createdAt: daysFromNow(-116, 9), updatedAt: daysFromNow(-100, 16),
  leadSource: "Direct", specsSummary: "New Member Kits"
});
createJob({
  title: "Launch Flyers + Banners",
  description: "Grand-opening flyers and vinyl banners.",
  stage: "DELIVERED", assignedTo: sales, customerId: kayraId, quoteAmount: 7200,
  dueDate: daysFromNow(-177), paidUpfront: 1, priority: "normal",
  notes: "Installed at the site.",
  createdAt: daysFromNow(-182, 9), updatedAt: daysFromNow(-175, 16),
  leadSource: "Direct", specsSummary: "Launch Flyers + Vinyl Banners"
});
// Aroma Luxe — newer account: one delivered + one open quote
createJob({
  title: "Retail Label Stickers — Trial Batch",
  description: "First trial batch of candle labels.",
  stage: "DELIVERED", assignedTo: sales, customerId: aromaId, quoteAmount: 7800,
  dueDate: daysFromNow(-23), paidUpfront: 1, priority: "normal",
  notes: "Client very happy with the finish — follow up on scale-up order.",
  createdAt: daysFromNow(-32, 9), updatedAt: daysFromNow(-21, 16),
  leadSource: "Instagram", specsSummary: "Label Stickers (Trial Batch)"
});
createJob({
  title: "Label Stickers — 2,000 Scale-up",
  description: "Scale-up label order across three fragrances.",
  stage: "QUOTED", assignedTo: sales, customerId: aromaId, quoteAmount: 9200,
  dueDate: daysFromNow(10), paidUpfront: 0, priority: "high",
  notes: "Quote sent; waiting on confirmation.",
  createdAt: daysFromNow(-1, 10), updatedAt: daysFromNow(-1, 10),
  leadSource: "Instagram", specsSummary: "2000 Label Stickers (3 Fragrances)"
});
// Gupta Traders — single delivered, no cadence rule
createJob({
  title: "Rate Cards + Envelopes",
  description: "Trade rate cards and letterhead envelopes.",
  stage: "DELIVERED", assignedTo: sales, customerId: guptaId, quoteAmount: 5600,
  dueDate: daysFromNow(-69), paidUpfront: 1, priority: "low",
  notes: "Delivered.",
  createdAt: daysFromNow(-86, 9), updatedAt: daysFromNow(-67, 15),
  leadSource: "Walk-in", specsSummary: "Rate Cards + Envelopes"
});
// City Events — fresh unquoted enquiry (short follow-up list demo)
createJob({
  title: "Corporate Gifting Kits — Diwali",
  description: "Enquiry for printed gifting kits (boxes + inserts) ahead of Diwali. Quantity TBD by client.",
  stage: "ENQUIRY", assignedTo: sales, customerId: cityId, quoteAmount: null,
  dueDate: null, paidUpfront: 0, priority: "normal",
  notes: "Rahul asked for a call this week to size the order.",
  createdAt: daysFromNow(-1, 10), updatedAt: daysFromNow(-1, 10),
  leadSource: "Phone Call", specsSummary: "Gifting Kits — quantity unconfirmed"
});

// ---------------------------------------------------------------------------
// Notes (Communication Log) — a few realistic entries
// ---------------------------------------------------------------------------
addNote("Neha usually approves proofs same day if pinged on WhatsApp; prefers 300gsm matte for cards.", abhishek.id, brightId, null, 34);
addNote("Repeat orders come in ~ every 6-8 weeks; send a WhatsApp check-in before she calls us.", abhishek.id, brightId, null, 6);
addNote("Rahul is fine with in-house design help but always needs a same-day proof.", abhishek.id, cityId, null, 5);
addNote("Vihaan posters need extra drying time — book lamination before 4pm to avoid queue.", siddhant.id, vihaanId, null, 2);
addNote("Karan is upset about the delay — update him personally with a new ETA.", samyak.id, singhId, null, 1);

// ---------------------------------------------------------------------------
// Activities — audit trail that mirrors the real stage/owner history
// ---------------------------------------------------------------------------
function seedLifecycle(jobId, customerId, createdDaysAgo, quoteDaysAgo, designDaysAgo, printDaysAgo, extra, extraBy) {
  addActivity(`Created new job #${jobId}`, abhishek.id, jobId, customerId, createdDaysAgo);
  if (quoteDaysAgo) {
    addActivity(`Moved stage from ENQUIRY → QUOTED — now owned by ${abhishek.name} (SALES)`, abhishek.id, jobId, customerId, quoteDaysAgo);
  }
  if (designDaysAgo) {
    addActivity(`Moved stage from QUOTED → DESIGN — now owned by ${abhishek.name} (SALES)`, abhishek.id, jobId, customerId, designDaysAgo);
    addActivity("Client approved the digital proof on WhatsApp", abhishek.id, jobId, customerId, designDaysAgo - 1);
  }
  if (printDaysAgo) {
    addActivity(`Moved stage from DESIGN → PRINTING — now owned by ${siddhant.name} (PRODUCTION)`, abhishek.id, jobId, customerId, printDaysAgo);
  }
  if (extra) addActivity(extra.description, extra.by || siddhant.id, jobId, customerId, extra.daysAgo);
}

seedLifecycle(1, brightId, 40, 39, 35, 32, { description: `Moved stage from READY → DELIVERED — now owned by ${abhishek.name} (SALES, payment & follow-up)`, by: siddhant.id, daysAgo: 3 });
seedLifecycle(2, brightId, 3, 2, null, null, { description: "Sent repeat quote ₹12,600 — same as last run, awaiting client confirmation", by: abhishek.id, daysAgo: 1 });
seedLifecycle(3, cityId, 6, 5, 4, null, { description: "Urgent — proof with client; gold foil cover confirmed", by: abhishek.id, daysAgo: 1 });
seedLifecycle(6, vihaanId, 14, 13, 12, 7, { description: "A1 posters moved to lamination queue — due tomorrow", by: siddhant.id, daysAgo: 1 });
seedLifecycle(7, singhId, 10, 9, 8, 6, { description: "⚠️ Flagged late: premium cardstock delayed at distributor — expediting today", by: siddhant.id, daysAgo: 2 });
addActivity("Called Karan with updated ETA — apologized and promised personal delivery", abhishek.id, 7, singhId, 1);
seedLifecycle(21, kayraId, 5, null, null, 3, null);
addActivity("Received new-member kit artwork from Farhan — queued for print", abhishek.id, 21, kayraId, 4);

console.log("Seed complete.");
console.log(`  Users: ${db.prepare("SELECT COUNT(*) c FROM users").get().c}`);
console.log(`  Customers: ${db.prepare("SELECT COUNT(*) c FROM customers").get().c}`);
console.log(`  Jobs: ${db.prepare("SELECT COUNT(*) c FROM jobs").get().c}`);
console.log(`  Notes: ${db.prepare("SELECT COUNT(*) c FROM notes").get().c}`);
console.log(`  Activities: ${db.prepare("SELECT COUNT(*) c FROM activities").get().c}`);
