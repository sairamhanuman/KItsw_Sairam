// routes/result-upload.js
// ============================================================
//  CSV Upload handler for Result Analysis module
//  Supports: result_data, result_data_coursewise, graduants, result_admissions
//
//  Mount in server.js:
//    const resultUploadRoutes = require('./routes/result-upload');
//    app.use('/api', resultUploadRoutes.initializeRouter(promisePool));
// ============================================================

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const csv     = require('csv-parse/sync');   // npm install csv-parse

// multer — memory storage (parse CSV in-memory, no disk files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },  // 20 MB max
  fileFilter(req, file, cb) {
    if (path.extname(file.originalname).toLowerCase() === '.csv') return cb(null, true);
    cb(new Error('Only .csv files are accepted'));
  }
});

// ── Column maps: CSV header → MySQL column ──────────────────
const TABLE_CONFIGS = {
  result_data: {
    required: ['roll_no','batch','semester','branch','programme'],
    columns:  ['roll_no','batch','semester','branch','exam_date','appeared',
               'pf_status','student_name','sgpa','cgpa','programme',
               'admission_type','final_status','main_status',
               'sgpa_pct','sgpa_slab','cgpa_pct','sgpa_division','cgpa_division']
  },
  result_data_coursewise: {
    required: ['roll_no','batch','semester','branch','subject_name'],
    columns:  ['branch','semester','roll_no','subject_name','subject_short_name',
               'sgpa','cgpa','ta_marks','mse_marks','ext_marks',
               'total_marks','grade','exam_month','batch','curriculum']
  },
  graduants: {
    required: ['programme','academic_year','current_batch','branch','htno'],
    columns:  ['programme','academic_year','current_batch','branch','htno',
               'student_name','division','backlog_status']
  },
  result_admissions: {
    required: ['roll_no'],
    columns:  ['roll_no','admission_type'],
    upsert:   true   // ON DUPLICATE KEY UPDATE
  }
};

function initializeRouter(db) {
  const router = express.Router();

  // POST /api/result-upload
  router.post('/result-upload', upload.single('file'), async (req, res) => {
    try {
      const tableName = req.body.table;
      const config    = TABLE_CONFIGS[tableName];

      if (!config) {
        return res.status(400).json({ success: false, error: `Unknown table: ${tableName}` });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      // Parse CSV
      let records;
      try {
        records = csv.parse(req.file.buffer.toString('utf8'), {
          columns:          true,
          skip_empty_lines: true,
          trim:             true,
          relax_quotes:     true
        });
      } catch (parseErr) {
        return res.status(400).json({ success: false, error: 'CSV parse error: ' + parseErr.message });
      }

      if (!records.length) {
        return res.json({ success: true, message: 'File has no data rows', rowsInserted: 0 });
      }

      // Validate required columns exist in CSV
      const csvHeaders = Object.keys(records[0]);
      const missing    = config.required.filter(c => !csvHeaders.includes(c));
      if (missing.length) {
        return res.status(400).json({
          success: false,
          error:   `Missing required columns: ${missing.join(', ')}. CSV has: ${csvHeaders.join(', ')}`
        });
      }

      // Filter to known columns only
      const cols = config.columns.filter(c => csvHeaders.includes(c));
      if (!cols.length) {
        return res.status(400).json({ success: false, error: 'No matching columns found' });
      }

      // Batch insert (500 rows at a time)
      const BATCH = 500;
      let rowsInserted = 0;

      const placeholders = `(${cols.map(() => '?').join(',')})`;
      const insertSQL    = config.upsert
        ? `INSERT INTO ${tableName} (${cols.join(',')}) VALUES ${placeholders}
           ON DUPLICATE KEY UPDATE ${cols.filter(c => c !== 'roll_no').map(c => `${c}=VALUES(${c})`).join(',')}`
        : `INSERT INTO ${tableName} (${cols.join(',')}) VALUES ${placeholders}`;

      for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);

        if (config.upsert) {
          // individual upserts for tables with UNIQUE key
          for (const row of batch) {
            const vals = cols.map(c => row[c] || null);
            await db.query(insertSQL, vals);
            rowsInserted++;
          }
        } else {
          // bulk multi-row insert
          const multiPlaceholders = batch.map(() => placeholders).join(',');
          const bulkSQL = `INSERT INTO ${tableName} (${cols.join(',')}) VALUES ${multiPlaceholders}`;
          const vals    = batch.flatMap(row => cols.map(c => row[c] || null));
          await db.query(bulkSQL, vals);
          rowsInserted += batch.length;
        }
      }

      // Log upload
      try {
        await db.query(
          `INSERT INTO result_uploads_log (uploaded_by, file_name, table_name, rows_inserted) VALUES (?,?,?,?)`,
          [req.headers['x-username'] || 'unknown', req.file.originalname, tableName, rowsInserted]
        );
      } catch(_) {}

      res.json({
        success:      true,
        message:      `Successfully uploaded to ${tableName}`,
        rowsInserted,
        fileName:     req.file.originalname
      });

    } catch (e) {
      console.error('Upload error:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // GET /api/result-upload/logs — view upload history
  router.get('/result-upload/logs', async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT * FROM result_uploads_log ORDER BY uploaded_at DESC LIMIT 100`);
      res.json({ success: true, data: rows });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/result-upload/clear/:table — clear a result table (Admin only)
  router.delete('/result-upload/clear/:table', async (req, res) => {
    const allowed = Object.keys(TABLE_CONFIGS);
    const table   = req.params.table;
    if (!allowed.includes(table)) {
      return res.status(400).json({ error: 'Table not allowed' });
    }
    try {
      await db.query(`DELETE FROM ${table}`);
      res.json({ success: true, message: `Cleared all rows from ${table}` });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}

module.exports = { initializeRouter };
