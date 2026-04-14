// ═══════════════════════════════════════════════════════════
//  EXAM BRANCH ACCOUNT LEDGER — API Routes
//  Add these routes to your server.js
//  Place BEFORE your app.listen() call
// ═══════════════════════════════════════════════════════════

const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');

// ── Multer setup for bill uploads ──────────────────────────
const billStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/ledger-bills/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueId = crypto.randomUUID();
    cb(null, 'bill-' + uniqueId + path.extname(file.originalname));
  }
});

const billUpload = multer({
  storage: billStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: function (req, file, cb) {
    const allowed = /jpeg|jpg|png|pdf/;
    const okMime = /image\/jpeg|image\/png|application\/pdf/.test(file.mimetype);
    const okExt = allowed.test(path.extname(file.originalname).toLowerCase());
    if (okMime && okExt) return cb(null, true);
    cb(new Error('Only JPG, PNG, PDF files allowed'));
  }
});

// ── DB Init (call this inside your initializeDatabase function) ──
async function initLedgerTables(promisePool) {
  await promisePool.query(`
    CREATE TABLE IF NOT EXISTS ledger_masters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type ENUM('Income','Expenditure') NOT NULL,
      name VARCHAR(150) NOT NULL,
      code VARCHAR(30),
      description VARCHAR(300),
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await promisePool.query(`
    CREATE TABLE IF NOT EXISTS ledger_master_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      master_id INT NOT NULL,
      name VARCHAR(150) NOT NULL,
      default_rate DECIMAL(12,2) DEFAULT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (master_id) REFERENCES ledger_masters(id) ON DELETE CASCADE
    )
  `);

  await promisePool.query(`
    CREATE TABLE IF NOT EXISTS ledger_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type ENUM('Income','Expenditure') NOT NULL,
      date DATE NOT NULL,
      category_id INT NOT NULL,
      sub_item_id INT DEFAULT NULL,
      amount DECIMAL(14,2) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES ledger_masters(id),
      FOREIGN KEY (sub_item_id) REFERENCES ledger_master_items(id) ON DELETE SET NULL
    )
  `);

  await promisePool.query(`
    CREATE TABLE IF NOT EXISTS ledger_bills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      transaction_id INT NOT NULL,
      original_name VARCHAR(255),
      file_path VARCHAR(500),
      file_type VARCHAR(100),
      file_size INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES ledger_transactions(id) ON DELETE CASCADE
    )
  `);

  console.log('✅ Ledger tables initialized');
}

// ── ROUTES ─────────────────────────────────────────────────

// GET /api/ledger/masters?type=Income|Expenditure|all
app.get('/api/ledger/masters', async (req, res) => {
  try {
    const { type } = req.query;
    let query = 'SELECT * FROM ledger_masters';
    const params = [];
    if (type && type !== 'all') {
      query += ' WHERE type = ?';
      params.push(type);
    }
    query += ' ORDER BY type, name ASC';
    const [rows] = await promisePool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// POST /api/ledger/masters
app.post('/api/ledger/masters', async (req, res) => {
  try {
    const { type, name, code, description } = req.body;
    if (!type || !name) return res.json({ success: false, message: 'type and name required' });
    const [result] = await promisePool.query(
      'INSERT INTO ledger_masters (type, name, code, description) VALUES (?,?,?,?)',
      [type, name.trim(), code?.trim() || null, description?.trim() || null]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// DELETE /api/ledger/masters/:id
app.delete('/api/ledger/masters/:id', async (req, res) => {
  try {
    await promisePool.query('DELETE FROM ledger_masters WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// GET /api/ledger/master-items/:masterId
app.get('/api/ledger/master-items/:masterId', async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      'SELECT * FROM ledger_master_items WHERE master_id = ? AND is_active = 1 ORDER BY name ASC',
      [req.params.masterId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// POST /api/ledger/master-items
app.post('/api/ledger/master-items', async (req, res) => {
  try {
    const { master_id, name, default_rate } = req.body;
    if (!master_id || !name) return res.json({ success: false, message: 'master_id and name required' });
    const [result] = await promisePool.query(
      'INSERT INTO ledger_master_items (master_id, name, default_rate) VALUES (?,?,?)',
      [master_id, name.trim(), default_rate || null]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// DELETE /api/ledger/master-items/:id
app.delete('/api/ledger/master-items/:id', async (req, res) => {
  try {
    await promisePool.query('DELETE FROM ledger_master_items WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// POST /api/ledger/entry  (multipart form with bill files)
app.post('/api/ledger/entry', billUpload.array('bills', 10), async (req, res) => {
  const conn = await promisePool.getConnection();
  try {
    await conn.beginTransaction();
    const { type, date, category_id, sub_item_id, amount, description } = req.body;
    if (!type || !date || !category_id || !amount)
      return res.json({ success: false, message: 'type, date, category_id, amount are required' });

    const [txnResult] = await conn.query(
      `INSERT INTO ledger_transactions (type, date, category_id, sub_item_id, amount, description)
       VALUES (?,?,?,?,?,?)`,
      [type, date, category_id, sub_item_id || null, parseFloat(amount), description?.trim() || null]
    );
    const txnId = txnResult.insertId;

    // Save bill files
    if (req.files && req.files.length) {
      for (const f of req.files) {
        await conn.query(
          `INSERT INTO ledger_bills (transaction_id, original_name, file_path, file_type, file_size)
           VALUES (?,?,?,?,?)`,
          [txnId, f.originalname, '/uploads/ledger-bills/' + f.filename, f.mimetype, f.size]
        );
      }
    }

    await conn.commit();
    res.json({ success: true, id: txnId });
  } catch (err) {
    await conn.rollback();
    res.json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// DELETE /api/ledger/entry/:id
app.delete('/api/ledger/entry/:id', async (req, res) => {
  try {
    // Bills are deleted via ON DELETE CASCADE
    await promisePool.query('DELETE FROM ledger_transactions WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// GET /api/ledger?from=&to=&type=&category_id=
app.get('/api/ledger', async (req, res) => {
  try {
    const { from, to, type, category_id } = req.query;
    let where = [];
    const params = [];

    if (from) { where.push('t.date >= ?'); params.push(from); }
    if (to)   { where.push('t.date <= ?'); params.push(to); }
    if (type) { where.push('t.type = ?'); params.push(type); }
    if (category_id) { where.push('t.category_id = ?'); params.push(category_id); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    // Transactions with running balance
    const [rows] = await promisePool.query(`
      SELECT
        t.id, t.type, t.date, t.amount, t.description,
        m.name AS category_name, m.code AS category_code,
        si.name AS sub_item_name,
        SUM(
          CASE WHEN t2.type='Income' THEN t2.amount
               WHEN t2.type='Expenditure' THEN -t2.amount ELSE 0 END
        ) AS running_balance
      FROM ledger_transactions t
      JOIN ledger_masters m ON t.category_id = m.id
      LEFT JOIN ledger_master_items si ON t.sub_item_id = si.id
      JOIN ledger_transactions t2 ON t2.id <= t.id
      ${whereClause.replace(/t\./g, 't.')}
      GROUP BY t.id
      ORDER BY t.date ASC, t.id ASC
    `, params.concat(params)); // params twice for sub-query not needed here; use window function below

    // Simpler running balance via subquery
    const [transactions] = await promisePool.query(`
      SELECT
        t.id, t.type, t.date, t.amount, t.description,
        m.name AS category_name, m.code AS category_code,
        si.name AS sub_item_name
      FROM ledger_transactions t
      JOIN ledger_masters m ON t.category_id = m.id
      LEFT JOIN ledger_master_items si ON t.sub_item_id = si.id
      ${whereClause}
      ORDER BY t.date ASC, t.id ASC
    `, params);

    // Fetch bills for each transaction
    if (transactions.length) {
      const ids = transactions.map(r => r.id);
      const [bills] = await promisePool.query(
        'SELECT * FROM ledger_bills WHERE transaction_id IN (?)',
        [ids]
      );
      const billMap = {};
      bills.forEach(b => {
        if (!billMap[b.transaction_id]) billMap[b.transaction_id] = [];
        billMap[b.transaction_id].push(b);
      });
      transactions.forEach(r => { r.bills = billMap[r.id] || []; });
    }

    // Compute running balance client-side approach: compute it server-side
    // Get ALL transactions sorted for running balance (not filtered)
    const [allTxns] = await promisePool.query(
      'SELECT id, type, amount, date FROM ledger_transactions ORDER BY date ASC, id ASC'
    );
    let runBal = 0;
    const balMap = {};
    allTxns.forEach(r => {
      runBal += r.type === 'Income' ? parseFloat(r.amount) : -parseFloat(r.amount);
      balMap[r.id] = runBal;
    });
    transactions.forEach(r => { r.running_balance = balMap[r.id] || 0; });

    // Summary
    const [sumRows] = await promisePool.query(`
      SELECT
        SUM(CASE WHEN type='Income' THEN amount ELSE 0 END) AS total_income,
        SUM(CASE WHEN type='Expenditure' THEN amount ELSE 0 END) AS total_expenditure,
        COUNT(*) AS total_transactions
      FROM ledger_transactions
      ${whereClause}
    `, params);

    const summary = sumRows[0];
    summary.balance = (parseFloat(summary.total_income || 0) - parseFloat(summary.total_expenditure || 0));

    res.json({ success: true, data: transactions, summary });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ── Export: call initLedgerTables inside your initializeDatabase() ──
module.exports = { initLedgerTables };

/*
  ─────────────────────────────────────────────────────────
  HOW TO INTEGRATE INTO YOUR server.js:
  ─────────────────────────────────────────────────────────

  1. Copy ALL the route definitions above (app.get, app.post,
     app.delete) into your server.js BEFORE app.listen().

  2. In your initializeDatabase() function, add:
       await initLedgerTables(promisePool);

  3. Make sure multer and crypto are already imported
     (they are in your existing server.js — just reuse them).

  4. The billUpload multer instance is separate from your
     existing student photo uploader — no conflicts.

  5. Add the menu link in index.html sidebar:
       <a href="exam-account-ledger.html" class="menu-item">
         Account Ledger
       </a>

  6. Ensure the uploads/ledger-bills/ folder is served:
       app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
     (Already in your server.js — no change needed)
  ─────────────────────────────────────────────────────────
*/
