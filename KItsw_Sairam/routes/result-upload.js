// routes/result-upload.js
// ============================================================
//  CSV Upload handler for Result Analysis module
//  Supports: result_data, result_data_coursewise, graduants, result_admissions
//
//  Features:
//   - Validates programme / batch / semester / branch against master tables
//   - exam_month field (replaces exam_date)
//   - GET /api/result-upload/sample/:table  → download sample CSV
//   - POST /api/result-upload               → upload + validate CSV
//   - GET  /api/result-upload/logs          → upload history
//   - DELETE /api/result-upload/clear/:table → clear table
//   - GET /api/result-upload/masters        → filter options for upload form
//
//  Mount in server.js:
//    const resultUploadRoutes = require('./routes/result-upload');
//    app.use('/api', resultUploadRoutes.initializeRouter(promisePool));
// ============================================================

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const csv     = require('csv-parse/sync');   // npm install csv-parse
// xlsx is loaded lazily below — run:  npm install xlsx
let XLSX = null;
try { XLSX = require('xlsx'); } catch(_) {}

// multer — memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv' || ext === '.xlsx') return cb(null, true);
    cb(new Error('Only .csv or .xlsx files are accepted'));
  }
});

// ── Table configs ────────────────────────────────────────────
const TABLE_CONFIGS = {
  result_data: {
    label:    'Result Data',
    required: ['roll_no', 'batch', 'semester', 'branch', 'programme'],
    // Columns that must match master tables (checked during upload)
    masterValidate: ['programme', 'batch', 'semester', 'branch'],
    columns: [
      'roll_no', 'batch', 'semester', 'branch', 'exam_month',
      'appeared', 'pf_status', 'student_name', 'sgpa', 'cgpa',
      'programme', 'admission_type', 'final_status', 'main_status',
      'sgpa_pct', 'sgpa_slab', 'cgpa_pct', 'sgpa_division', 'cgpa_division'
    ],
    sampleRow: {
      roll_no: '21A91A0501', batch: '2021-25', semester: 'V',
      branch: 'CSE', exam_month: 'November 2024',
      appeared: 'A', pf_status: 'P', student_name: 'RAVI KUMAR',
      sgpa: '8.20', cgpa: '7.90', programme: 'B.Tech',
      admission_type: '', final_status: '', main_status: '',
      sgpa_pct: '', sgpa_slab: '', cgpa_pct: '', sgpa_division: '', cgpa_division: ''
    }
  },
  result_data_coursewise: {
    label:    'Course Wise Data',
    required: ['roll_no', 'batch', 'semester', 'branch', 'subject_name'],
    masterValidate: ['batch', 'semester', 'branch'],
    columns: [
      'branch', 'semester', 'roll_no', 'subject_name', 'subject_short_name',
      'sgpa', 'cgpa', 'ta_marks', 'mse_marks', 'ext_marks',
      'total_marks', 'grade', 'exam_month', 'batch', 'curriculum'
    ],
    sampleRow: {
      branch: 'CSE', semester: 'V', roll_no: '21A91A0501',
      subject_name: 'Data Structures', subject_short_name: 'DS',
      sgpa: '8.20', cgpa: '7.90',
      ta_marks: '25', mse_marks: '22', ext_marks: '58',
      total_marks: '105', grade: 'A', exam_month: 'November 2024',
      batch: '2021-25', curriculum: 'R20'
    }
  },
  graduants: {
    label:    'Graduants',
    required: ['programme', 'academic_year', 'current_batch', 'branch', 'htno'],
    masterValidate: ['programme', 'branch'],
    columns: [
      'programme', 'academic_year', 'current_batch', 'branch',
      'htno', 'student_name', 'division', 'backlog_status'
    ],
    sampleRow: {
      programme: 'B.Tech', academic_year: '2024-25',
      current_batch: '2021', branch: 'CSE',
      htno: '21A91A0501', student_name: 'RAVI KUMAR',
      division: 'FIRST CLASS', backlog_status: ''
    }
  },
  result_admissions: {
    label:    'Admissions',
    required: ['roll_no'],
    masterValidate: [],
    columns:  ['roll_no', 'admission_type'],
    upsert:   true,
    sampleRow: {
      roll_no: '21A91A0501', admission_type: 'Regular In Take'
    }
  }
};

// ── Helper: fetch valid values from master tables ─────────────
async function getMasterValues(db) {
  // Try queries in order — return first one that succeeds AND has rows
  const tryQueries = async (...queries) => {
    for (const q of queries) {
      try {
        const [r] = await db.query(q);
        const vals = r.map(x => Object.values(x)[0]).filter(Boolean);
        if (vals.length > 0) return vals;
      } catch (_) {}
    }
    return [];
  };

  // Programmes
  const programmes = await tryQueries(
    `SELECT DISTINCT programme_name FROM programme_master WHERE is_active=1 ORDER BY programme_name`,
    `SELECT DISTINCT programme_name FROM programme_master ORDER BY programme_name`,
    `SELECT DISTINCT name FROM programme_master ORDER BY name`,
    `SELECT DISTINCT programme FROM result_data ORDER BY programme`
  );

  // Batches
  const batches = await tryQueries(
    `SELECT DISTINCT batch_name FROM batch_master WHERE is_active=1 ORDER BY batch_name`,
    `SELECT DISTINCT batch_name FROM batch_master ORDER BY batch_name`,
    `SELECT DISTINCT name FROM batch_master ORDER BY name`,
    `SELECT DISTINCT batch FROM result_data ORDER BY batch`
  );

  // Semesters — try every plausible column name variant
  const semesters = await tryQueries(
    `SELECT DISTINCT semester_name FROM semester_master WHERE is_active=1 ORDER BY CAST(semester_order AS UNSIGNED)`,
    `SELECT DISTINCT semester_name FROM semester_master ORDER BY CAST(semester_order AS UNSIGNED)`,
    `SELECT DISTINCT semester_name FROM semester_master ORDER BY semester_name`,
    `SELECT DISTINCT name          FROM semester_master ORDER BY name`,
    `SELECT DISTINCT sem_name      FROM semester_master ORDER BY sem_name`,
    `SELECT DISTINCT semester      FROM semester_master ORDER BY semester`,
    `SELECT DISTINCT semester_no   FROM semester_master ORDER BY semester_no`,
    `SELECT DISTINCT semester FROM result_data ORDER BY semester`
  );

  // Branches
  const branches = await tryQueries(
    `SELECT DISTINCT branch_name FROM branch_master WHERE is_active=1 ORDER BY branch_name`,
    `SELECT DISTINCT branch_name FROM branch_master ORDER BY branch_name`,
    `SELECT DISTINCT name        FROM branch_master ORDER BY name`,
    `SELECT DISTINCT branch FROM result_data ORDER BY branch`
  );

  return { programmes, batches, semesters, branches };
}

// ── Helper: build sample CSV string ──────────────────────────
function buildSampleCSV(config) {
  const cols = config.columns;
  const header = cols.join(',');
  const row = cols.map(c => {
    const val = config.sampleRow[c] ?? '';
    return String(val).includes(',') ? `"${val}"` : val;
  }).join(',');
  return header + '\n' + row + '\n';
}

// ── Helper: fix Excel date serial → "Month YYYY" string ─────────
// Excel stores dates as integers (days since 1899-12-30).
// If exam_month comes in as a number like 45596, convert it.
function fixExamMonth(val) {
  if (!val) return val;
  const s = String(val).trim();
  // Already looks like "November 2024" or "Nov 2024" → keep as-is
  if (/^[A-Za-z]/.test(s)) return s;
  // Pure integer → treat as Excel serial date
  const serial = parseInt(s, 10);
  if (!isNaN(serial) && serial > 1000 && serial < 80000) {
    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    // Excel epoch: days since 1899-12-30
    const d = new Date((serial - 25569) * 86400 * 1000);  // JS uses Unix epoch
    // openpyxl / Excel serial → JS Date via offset
    // More reliable: manual calculation
    const excelEpoch = new Date(1899, 11, 30);
    const realDate   = new Date(excelEpoch.getTime() + serial * 86400 * 1000);
    const month = MONTHS[realDate.getMonth()];
    const year  = realDate.getFullYear();
    return `${month} ${year}`;
  }
  return s;
}

function initializeRouter(db) {
  const router = express.Router();

  // ── GET /api/result-upload/sample-template — generate Excel template in memory ──
  router.get('/result-upload/sample-template', (req, res) => {
    if (!XLSX) {
      return res.status(500).json({ error: 'xlsx package not installed. Run: npm install xlsx' });
    }
    const wb = XLSX.utils.book_new();

    // ── Helper: build a sheet with header row + sample rows ──────────
    function makeSheet(columns, sampleRows, warningMsg) {
      const ws = {};
      const R0 = 0; // warning row
      const R1 = 1; // header row
      // Warning row merged across all cols
      const warnCell = { v: warningMsg, t: 's' };
      ws['A1'] = warnCell;
      // Headers
      columns.forEach((col, ci) => {
        const addr = XLSX.utils.encode_cell({ r: R1, c: ci });
        ws[addr] = { v: col, t: 's' };
      });
      // Sample rows
      sampleRows.forEach((row, ri) => {
        columns.forEach((col, ci) => {
          const addr = XLSX.utils.encode_cell({ r: R1 + 1 + ri, c: ci });
          // exam_month col — force text type
          const val = row[col] ?? '';
          ws[addr] = { v: String(val), t: 's' };
        });
      });
      // Blank input rows (50) — exam_month col forced as text
      const examMonthIdx = columns.indexOf('exam_month');
      for (let ri = 0; ri < 50; ri++) {
        columns.forEach((col, ci) => {
          const addr = XLSX.utils.encode_cell({ r: R1 + 1 + sampleRows.length + ri, c: ci });
          ws[addr] = { v: '', t: 's' };
          // Force text format on exam_month column
          if (ci === examMonthIdx) {
            ws[addr].z = '@';
          }
        });
      }
      const totalRows = R1 + 1 + sampleRows.length + 50;
      ws['!ref'] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: totalRows, c: columns.length - 1 });
      // Column widths
      ws['!cols'] = columns.map(col => ({
        wch: col === 'student_name' || col === 'subject_name' || col === 'branch' ? 30
           : col === 'exam_month' ? 22
           : col === 'admission_type' || col === 'division' ? 28
           : col.length < 8 ? 12 : 18
      }));
      return ws;
    }

    const EXAM_WARN = 'WARNING: exam_month column — TYPE as plain text e.g.  November 2024  — do NOT use a date picker or Excel will store it as a number (which will cause upload errors)';

    // ── Sheet 1: result_data ──────────────────────────────────────────
    const rdCols = ['roll_no','batch','semester','branch','exam_month','appeared','pf_status',
                    'student_name','sgpa','cgpa','programme','admission_type','final_status',
                    'main_status','sgpa_pct','sgpa_slab','cgpa_pct','sgpa_division','cgpa_division'];
    const rdRows = [
      { roll_no:'21A91A0501', batch:'2021-25', semester:'V', branch:'CSE', exam_month:'November 2024',
        appeared:'A', pf_status:'P', student_name:'RAVI KUMAR', sgpa:'8.20', cgpa:'7.90', programme:'B.Tech',
        admission_type:'', final_status:'', main_status:'', sgpa_pct:'', sgpa_slab:'', cgpa_pct:'', sgpa_division:'', cgpa_division:'' },
      { roll_no:'21A91A0502', batch:'2021-25', semester:'V', branch:'CSE', exam_month:'November 2024',
        appeared:'A', pf_status:'F', student_name:'PRIYA SHARMA', sgpa:'4.50', cgpa:'5.10', programme:'B.Tech',
        admission_type:'', final_status:'', main_status:'', sgpa_pct:'', sgpa_slab:'', cgpa_pct:'', sgpa_division:'', cgpa_division:'' },
    ];
    XLSX.utils.book_append_sheet(wb, makeSheet(rdCols, rdRows, EXAM_WARN), 'result_data');

    // ── Sheet 2: result_data_coursewise ──────────────────────────────
    const cwCols = ['branch','semester','roll_no','subject_name','subject_short_name',
                    'sgpa','cgpa','ta_marks','mse_marks','ext_marks','total_marks',
                    'grade','exam_month','batch','curriculum'];
    const cwRows = [
      { branch:'CSE', semester:'V', roll_no:'21A91A0501', subject_name:'Data Structures', subject_short_name:'DS',
        sgpa:'8.20', cgpa:'7.90', ta_marks:'25', mse_marks:'22', ext_marks:'58', total_marks:'105',
        grade:'A', exam_month:'November 2024', batch:'2021-25', curriculum:'R20' },
      { branch:'CSE', semester:'V', roll_no:'21A91A0502', subject_name:'Data Structures', subject_short_name:'DS',
        sgpa:'4.50', cgpa:'5.10', ta_marks:'20', mse_marks:'18', ext_marks:'40', total_marks:'78',
        grade:'F', exam_month:'November 2024', batch:'2021-25', curriculum:'R20' },
    ];
    XLSX.utils.book_append_sheet(wb, makeSheet(cwCols, cwRows, EXAM_WARN), 'result_data_coursewise');

    // ── Sheet 3: graduants ────────────────────────────────────────────
    const grCols = ['programme','academic_year','current_batch','branch','htno',
                    'student_name','division','backlog_status'];
    const grRows = [
      { programme:'B.Tech', academic_year:'2024-25', current_batch:'2021', branch:'CSE',
        htno:'21A91A0501', student_name:'RAVI KUMAR', division:'FIRST CLASS', backlog_status:'' },
      { programme:'B.Tech', academic_year:'2024-25', current_batch:'2021', branch:'CSE',
        htno:'21A91A0502', student_name:'PRIYA SHARMA', division:'FIRST CLASS with DISTINCTION', backlog_status:'' },
    ];
    XLSX.utils.book_append_sheet(wb, makeSheet(grCols, grRows, 'Graduants upload template. Fill all required columns.'), 'graduants');

    // ── Sheet 4: result_admissions ────────────────────────────────────
    const adCols = ['roll_no','admission_type'];
    const adRows = [
      { roll_no:'21A91A0501', admission_type:'Regular In Take' },
      { roll_no:'21A91A0502', admission_type:'Regular Lateral In Take' },
    ];
    XLSX.utils.book_append_sheet(wb, makeSheet(adCols, adRows,
      'admission_type values: Regular In Take / Regular Lateral In Take / EWS / EWS_L'), 'result_admissions');

    // ── Sheet 5: Instructions (first sheet) ──────────────────────────
    const instrWs = {};
    const instrLines = [
      'HOW TO USE THIS UPLOAD TEMPLATE',
      '',
      'STEP 1: Choose the correct sheet tab for the data you want to upload.',
      '        result_data              → main result records (one row per student per semester)',
      '        result_data_coursewise   → subject/grade records (one row per student per subject)',
      '        graduants                → final year graduant records',
      '        result_admissions        → roll_no to admission_type mapping',
      '',
      '⚠️  EXAM MONTH — CRITICAL RULE:',
      '    Type exam_month as plain text:   November 2024',
      '    DO NOT click a date cell or use a date picker.',
      '    The column is pre-formatted as TEXT to prevent Excel converting it to a number.',
      '    If you see a number like 45596 — delete it and RE-TYPE as text.',
      '',
      'STEP 2: Fill your data rows starting from row 3 (below the header row).',
      '',
      'STEP 3: Save as .xlsx  (File → Save As → Excel Workbook .xlsx)',
      '',
      'STEP 4: In the Upload Data tab, choose the correct table and click Choose CSV/XLSX.',
      '',
      'VALID VALUES:',
      '  appeared        →  A',
      '  pf_status       →  P  or  F',
      '  grade           →  O / A+ / A / B+ / B / C / F / AB',
      '  division        →  FIRST CLASS with DISTINCTION / FIRST CLASS / SECOND DIVISION / PASS CLASS',
      '  admission_type  →  Regular In Take / Regular Lateral In Take / EWS / EWS_L',
      '  exam_month      →  Month YYYY  e.g.  November 2024  or  May 2025',
    ];
    instrLines.forEach((line, i) => {
      instrWs[XLSX.utils.encode_cell({ r: i, c: 0 })] = { v: line, t: 's' };
    });
    instrWs['!ref'] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: instrLines.length, c: 0 });
    instrWs['!cols'] = [{ wch: 90 }];
    // Insert instructions as first sheet
    XLSX.utils.book_append_sheet(wb, instrWs, 'Instructions');
    // Reorder so Instructions is first
    wb.SheetNames = ['Instructions', 'result_data', 'result_data_coursewise', 'graduants', 'result_admissions'];

    // ── Write and send ────────────────────────────────────────────────
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="result_upload_template.xlsx"');
    res.send(buf);
  });

  // ── GET /api/result-upload/debug — shows actual column names in master tables ──
  // Use this if dropdowns are empty: GET /api/result-upload/debug
  router.get('/result-upload/debug', async (req, res) => {
    const showCols = async (table) => {
      try {
        const [cols] = await db.query(`SHOW COLUMNS FROM ${table}`);
        const [sample] = await db.query(`SELECT * FROM ${table} LIMIT 3`);
        return { columns: cols.map(c => c.Field), sample };
      } catch (e) { return { error: e.message }; }
    };
    res.json({
      semester_master:  await showCols('semester_master'),
      programme_master: await showCols('programme_master'),
      batch_master:     await showCols('batch_master'),
      branch_master:    await showCols('branch_master')
    });
  });

  // ── GET /api/result-upload/masters — filter options for upload UI ──
  router.get('/result-upload/masters', async (req, res) => {
    try {
      const masters = await getMasterValues(db);
      res.json({ success: true, ...masters });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── GET /api/result-upload/sample/:table — download sample CSV ──
  // Query params: programme, batch, semester, exam_month, branch
  // These are injected into the sample row so the user sees real values.
  router.get('/result-upload/sample/:table', (req, res) => {
    const tableName = req.params.table;
    const config = TABLE_CONFIGS[tableName];
    if (!config) return res.status(400).json({ error: 'Unknown table' });

    // Merge query param overrides into sampleRow
    const overrides = {
      programme:  req.query.programme  || config.sampleRow.programme  || '',
      batch:      req.query.batch      || config.sampleRow.batch      || '',
      semester:   req.query.semester   || config.sampleRow.semester   || '',
      exam_month: req.query.exam_month || config.sampleRow.exam_month || '',
      branch:     req.query.branch     || config.sampleRow.branch     || ''
    };
    const mergedConfig = {
      ...config,
      sampleRow: { ...config.sampleRow, ...overrides }
    };

    const csvContent = buildSampleCSV(mergedConfig);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="sample_${tableName}.csv"`);
    res.send(csvContent);
  });

  // ── POST /api/result-upload — upload CSV ──────────────────────────
  router.post('/result-upload', upload.single('file'), async (req, res) => {
    try {
      const tableName = req.body.table;
      const config    = TABLE_CONFIGS[tableName];

      if (!config) return res.status(400).json({ success: false, error: `Unknown table: ${tableName}` });
      if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

      // Parse CSV or XLSX
      let records;
      const fileExt = path.extname(req.file.originalname).toLowerCase();
      try {
        if (fileExt === '.xlsx') {
          if (!XLSX) {
            return res.status(500).json({ success: false, error: 'xlsx package not installed on server. Run: npm install xlsx' });
          }
          // Parse XLSX — read the sheet matching the table name, or first data sheet
          const workbook  = XLSX.read(req.file.buffer, { type: 'buffer', cellText: true, cellDates: false });
          // Try to find a sheet named after the table, else use first non-Instructions sheet
          const sheetName = workbook.SheetNames.find(n => n === tableName)
            || workbook.SheetNames.find(n => !n.includes('Instruction') && !n.includes('📋'))
            || workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          // Find the header row — look for a row containing the first required column
          const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
          let headerRow = -1;
          for (let i = 0; i < Math.min(raw.length, 15); i++) {
            if (config.required.some(col => raw[i].includes(col))) { headerRow = i; break; }
          }
          if (headerRow === -1) headerRow = 0;
          const headers = raw[headerRow].map(h => String(h).trim());
          records = [];
          for (let i = headerRow + 1; i < raw.length; i++) {
            const rowArr = raw[i];
            // Skip completely empty rows
            if (rowArr.every(v => v === '' || v === null || v === undefined)) continue;
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = String(rowArr[idx] ?? '').trim(); });
            records.push(obj);
          }
        } else {
          // Parse CSV
          records = csv.parse(req.file.buffer.toString('utf8'), {
            columns:          true,
            skip_empty_lines: true,
            trim:             true,
            relax_quotes:     true
          });
        }
      } catch (parseErr) {
        return res.status(400).json({ success: false, error: `${fileExt.toUpperCase()} parse error: ` + parseErr.message });
      }

      if (!records.length) return res.json({ success: true, message: 'File has no data rows', rowsInserted: 0 });

      // Validate required columns
      const csvHeaders = Object.keys(records[0]);
      const missing = config.required.filter(c => !csvHeaders.includes(c));
      if (missing.length) {
        return res.status(400).json({
          success: false,
          error: `Missing required columns: ${missing.join(', ')}. CSV has: ${csvHeaders.join(', ')}`
        });
      }

      // ── Pre-process: fix Excel date serials in exam_month ──────────
      // If user saved CSV from Excel, date cells become integers like 45596.
      // Convert them to "Month YYYY" strings before any validation.
      records = records.map(row => {
        if (row.exam_month) {
          row.exam_month = fixExamMonth(row.exam_month);
        }
        return row;
      });

      // ── Step 1: Filter-exact validation ──────────────────────────
      // If the user selected specific filter values in the upload form,
      // every CSV row must match those exact values.
      const filterProg     = req.body.filter_programme  || '';
      const filterBatch    = req.body.filter_batch      || '';
      const filterSem      = req.body.filter_semester   || '';
      const filterMonth    = req.body.filter_exam_month || '';
      const filterBranch   = req.body.filter_branch     || '';

      const filterErrors = [];
      records.forEach((row, idx) => {
        const rowNum = idx + 2; // +2 because row 1 is header
        if (filterProg   && row.programme  && row.programme  !== filterProg)
          filterErrors.push(`Row ${rowNum}: programme "${row.programme}" ≠ selected "${filterProg}"`);
        if (filterBatch  && row.batch      && row.batch      !== filterBatch)
          filterErrors.push(`Row ${rowNum}: batch "${row.batch}" ≠ selected "${filterBatch}"`);
        if (filterSem    && row.semester   && row.semester   !== filterSem)
          filterErrors.push(`Row ${rowNum}: semester "${row.semester}" ≠ selected "${filterSem}"`);
        if (filterMonth  && row.exam_month && row.exam_month !== filterMonth)
          filterErrors.push(`Row ${rowNum}: exam_month "${row.exam_month}" ≠ selected "${filterMonth}"`);
        if (filterBranch && row.branch     && row.branch     !== filterBranch && tableName === 'result_data_coursewise')
          filterErrors.push(`Row ${rowNum}: branch "${row.branch}" ≠ selected "${filterBranch}"`);
      });

      if (filterErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: `❌ Filter mismatch (${filterErrors.length} row(s)):\n` +
            filterErrors.slice(0, 15).join('\n') +
            (filterErrors.length > 15 ? `\n...and ${filterErrors.length - 15} more rows` : '') +
            `\n\nTip: Make sure your CSV matches the selected Programme / Batch / Semester / Exam Month.`
        });
      }

      // ── Step 2: Master-table validation ──────────────────────────
      // Check each value against the master tables (allowed values)
      const masters = await getMasterValues(db);
      const masterMap = {
        programme: masters.programmes,
        batch:     masters.batches,
        semester:  masters.semesters,
        branch:    masters.branches
      };

      const validationErrors = [];
      if (config.masterValidate.length > 0 && masters.programmes.length > 0) {
        records.forEach((row, idx) => {
          config.masterValidate.forEach(field => {
            const val = row[field];
            if (!val) return;
            const validList = masterMap[field];
            if (validList && validList.length > 0 && !validList.includes(val)) {
              validationErrors.push(`Row ${idx + 2}: Invalid ${field} "${val}". Allowed: ${validList.slice(0, 8).join(', ')}${validList.length > 8 ? '...' : ''}`);
            }
          });
        });
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: `❌ Master validation failed (${validationErrors.length} error(s)):\n` +
            validationErrors.slice(0, 10).join('\n') +
            (validationErrors.length > 10 ? `\n...and ${validationErrors.length - 10} more` : '')
        });
      }
      // ─────────────────────────────────────────────────────────────

      // Filter to known columns
      const cols = config.columns.filter(c => csvHeaders.includes(c));
      if (!cols.length) return res.status(400).json({ success: false, error: 'No matching columns found' });

      // Batch insert (500 rows at a time)
      const BATCH = 500;
      let rowsInserted = 0;
      const placeholders = `(${cols.map(() => '?').join(',')})`;

      for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);

        if (config.upsert) {
          const insertSQL = `INSERT INTO ${tableName} (${cols.join(',')}) VALUES ${placeholders}
            ON DUPLICATE KEY UPDATE ${cols.filter(c => c !== 'roll_no').map(c => `${c}=VALUES(${c})`).join(',')}`;
          for (const row of batch) {
            const vals = cols.map(c => row[c] || null);
            await db.query(insertSQL, vals);
            rowsInserted++;
          }
        } else {
          const multiPlaceholders = batch.map(() => placeholders).join(',');
          const bulkSQL = `INSERT INTO ${tableName} (${cols.join(',')}) VALUES ${multiPlaceholders}`;
          const vals = batch.flatMap(row => cols.map(c => row[c] || null));
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
      } catch (_) {}

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

  // ── GET /api/result-upload/logs ──────────────────────────────────
  router.get('/result-upload/logs', async (req, res) => {
    try {
      const [rows] = await db.query(`SELECT * FROM result_uploads_log ORDER BY uploaded_at DESC LIMIT 100`);
      res.json({ success: true, data: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── DELETE /api/result-upload/clear/:table ───────────────────────
  router.delete('/result-upload/clear/:table', async (req, res) => {
    const allowed = Object.keys(TABLE_CONFIGS);
    const table   = req.params.table;
    if (!allowed.includes(table)) return res.status(400).json({ error: 'Table not allowed' });
    try {
      await db.query(`DELETE FROM ${table}`);
      res.json({ success: true, message: `Cleared all rows from ${table}` });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
}

module.exports = { initializeRouter };
