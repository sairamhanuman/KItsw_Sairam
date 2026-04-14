// routes/result-analysis.js
// ============================================================
//  RESULT ANALYSIS ROUTES — adapted for engineering_college
//  Uses your existing promisePool (mysql2/promise)
//  Mount in server.js:
//    const resultAnalysisRoutes = require('./routes/result-analysis');
//    app.use('/api', resultAnalysisRoutes.initializeRouter(promisePool));
// ============================================================

const express = require('express');

// ── Helpers ────────────────────────────────────────────────
function fmt(cnt, total) {
  if (!total) return '0<br>(0%)';
  return `${cnt}<br>(${Math.round((cnt / total) * 100)}%)`;
}

// ── Router factory (receives your promisePool) ──────────────
function initializeRouter(db) {
  const router = express.Router();

  /* ═══════════════════════════════════════════════════════════
     MASTER FILTERS — sourced from master tables
     GET /api/result/master-filters
     Returns: programmes, batches, semesters, branches, examMonths
  ═══════════════════════════════════════════════════════════ */

  router.get('/result/master-filters', async (req, res) => {
    try {
      // Pull from your existing master tables
      const [progRows]    = await db.query(`SELECT DISTINCT programme_name AS val FROM programme_master WHERE is_active=1 ORDER BY programme_name`).catch(async () => {
        // fallback: pull from result_data itself
        const [r] = await db.query(`SELECT DISTINCT programme AS val FROM result_data ORDER BY programme`);
        return [r];
      });
      const [batchRows]   = await db.query(`SELECT DISTINCT batch_name AS val FROM batch_master WHERE is_active=1 ORDER BY batch_name`).catch(async () => {
        const [r] = await db.query(`SELECT DISTINCT batch AS val FROM result_data ORDER BY batch`);
        return [r];
      });
      const [semRows]     = await db.query(`SELECT DISTINCT semester_name AS val FROM semester_master WHERE is_active=1 ORDER BY semester_order`).catch(async () => {
        const [r] = await db.query(`SELECT DISTINCT semester AS val FROM result_data ORDER BY semester`);
        return [r];
      });
      const [branchRows]  = await db.query(`SELECT DISTINCT branch_name AS val FROM branch_master WHERE is_active=1 ORDER BY branch_name`).catch(async () => {
        const [r] = await db.query(`SELECT DISTINCT branch AS val FROM result_data ORDER BY branch`);
        return [r];
      });
      // exam months come from result_data (no static master)
      const [monthRows]   = await db.query(`SELECT DISTINCT exam_month AS val FROM result_data WHERE exam_month IS NOT NULL ORDER BY exam_month`);

      res.json({
        programmes: progRows.map(r => r.val).filter(Boolean),
        batches:    batchRows.map(r => r.val).filter(Boolean),
        semesters:  semRows.map(r => r.val).filter(Boolean),
        branches:   branchRows.map(r => r.val).filter(Boolean),
        examMonths: monthRows.map(r => r.val).filter(Boolean)
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ═══════════════════════════════════════════════════════════
     1.  RESULT ANALYSIS  —  /api/result/*
  ═══════════════════════════════════════════════════════════ */

  router.get('/result/filters', async (req, res) => {
    try {
      const [rows] = await db.query(`
        SELECT DISTINCT programme, batch, semester
        FROM result_data
        WHERE programme IS NOT NULL AND batch IS NOT NULL AND semester IS NOT NULL
        ORDER BY batch, semester`);
      res.json({
        programmes: [...new Set(rows.map(r => r.programme))],
        batches:    [...new Set(rows.map(r => r.batch))],
        semesters:  [...new Set(rows.map(r => r.semester))]
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/result/analysis', async (req, res) => {
    const { programme, batch, semester } = req.query;
    try {
      const [rows] = await db.query(`
        SELECT branch, exam_month,
               SUM(appeared = 'A')                       AS appeared,
               SUM(appeared = 'A' AND pf_status = 'P')   AS pass_count
        FROM result_data
        WHERE programme = ? AND batch = ? AND semester = ?
        GROUP BY branch, exam_month
        ORDER BY branch`,
        [programme, batch, semester]);

      let totalApp = 0, totalPass = 0, resultMonth = '';
      const result = rows.map(r => {
        const app = Number(r.appeared), pass = Number(r.pass_count);
        totalApp += app; totalPass += pass;
        if (!resultMonth && r.exam_month) resultMonth = r.exam_month;
        return { branch: r.branch, appeared: app, pass, percent: app ? ((pass / app) * 100).toFixed(2) : '0.00' };
      });

      res.json({
        headingLine1: `${programme} ${batch} Batch – Semester ${semester}`,
        headingLine2: `Result Declaration Month : ${resultMonth || 'N/A'}`,
        rows: result, totalAppeared: totalApp, totalPass,
        totalPercent: totalApp ? ((totalPass / totalApp) * 100).toFixed(2) : '0.00'
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ═══════════════════════════════════════════════════════════
     2.  RESULT STATISTICS  —  /api/stats/*
  ═══════════════════════════════════════════════════════════ */

  router.get('/stats/filters', async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT DISTINCT programme, batch FROM result_data ORDER BY batch`);
      res.json({
        programmes: [...new Set(rows.map(r => r.programme))],
        batches:    [...new Set(rows.map(r => r.batch))]
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/stats/semester-wise', async (req, res) => {
    const { programme, batch } = req.query;
    const SEMESTERS = ['I','II','III','IV','V','VI','VII','VIII'];
    try {
      const [semRows] = await db.query(`
        SELECT branch, semester,
               SUM(appeared = 'A')                       AS appeared,
               SUM(appeared = 'A' AND pf_status = 'P')   AS pass_count
        FROM result_data
        WHERE programme = ? AND batch = ?
        GROUP BY branch, semester`,
        [programme, batch]);

      const [gradRows] = await db.query(`
        SELECT branch,
               COUNT(*) AS total,
               SUM(backlog_status = 'Without Any Backlog') AS no_backlog
        FROM graduants
        WHERE programme = ? AND current_batch = CAST(SUBSTRING(?, 1, 4) AS UNSIGNED)
        GROUP BY branch`,
        [programme, batch]);

      const semStats = {};
      semRows.forEach(r => {
        if (!semStats[r.branch]) semStats[r.branch] = {};
        semStats[r.branch][r.semester] = { appeared: Number(r.appeared), pass: Number(r.pass_count) };
      });

      const gradStats = {};
      gradRows.forEach(r => {
        gradStats[r.branch] = { total: Number(r.total), noBacklog: Number(r.no_backlog) };
      });

      const branches = Object.keys(semStats).sort();
      const tableData = branches.map(br => {
        const row = { branch: br };
        SEMESTERS.forEach(sem => {
          const s = semStats[br][sem];
          row[sem] = s ? `${s.pass}/${s.appeared}` : '-';
        });
        const g = gradStats[br] || { total: 0, noBacklog: 0 };
        row.gradTotal   = g.total;
        row.gradNoBacklog = g.noBacklog;
        return row;
      });

      res.json({ semesters: SEMESTERS, rows: tableData });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ═══════════════════════════════════════════════════════════
     3.  SGPA ANALYSIS  —  /api/sgpa/*
  ═══════════════════════════════════════════════════════════ */

  router.get('/sgpa/filters', async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT DISTINCT programme, batch, semester, main_status FROM result_data ORDER BY batch, semester`);
      res.json({
        programmes: [...new Set(rows.map(r => r.programme))],
        batches:    [...new Set(rows.map(r => r.batch))],
        semesters:  [...new Set(rows.map(r => r.semester))],
        statuses:   [...new Set(rows.map(r => r.main_status))]
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/sgpa/analysis', async (req, res) => {
    const { programme, batch, semester, candStatus } = req.query;
    const SLABS = ['More 90%','80-89%','70-79%','60-69%','50-59%','Less than 50','Fail'];
    try {
      const [rows] = await db.query(`
        SELECT branch, sgpa_slab, COUNT(*) AS cnt
        FROM result_data
        WHERE programme=? AND batch=? AND semester=? AND main_status=? AND appeared='A'
        GROUP BY branch, sgpa_slab`,
        [programme, batch, semester, candStatus]);

      const branchMap = {};
      rows.forEach(r => {
        if (!branchMap[r.branch]) branchMap[r.branch] = {};
        branchMap[r.branch][r.sgpa_slab] = Number(r.cnt);
      });

      const [totRows] = await db.query(`
        SELECT branch, COUNT(*) AS total
        FROM result_data
        WHERE programme=? AND batch=? AND semester=? AND main_status=? AND appeared='A'
        GROUP BY branch`,
        [programme, batch, semester, candStatus]);

      const totals = {};
      totRows.forEach(r => { totals[r.branch] = Number(r.total); });

      const branches = Object.keys(branchMap).sort();
      const tableRows = branches.map(br => {
        const row = { branch: br, total: totals[br] || 0 };
        SLABS.forEach(s => { row[s] = branchMap[br][s] || 0; });
        return row;
      });

      res.json({ slabs: SLABS, rows: tableRows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ═══════════════════════════════════════════════════════════
     4.  SGPA DIVISION  —  /api/sgpadiv/*
  ═══════════════════════════════════════════════════════════ */

  router.get('/sgpadiv/analysis', async (req, res) => {
    const { programme, batch, semester, candStatus } = req.query;
    const DIVS = ['Distinction','First Class','Second Class','Pass','Fail'];
    try {
      const [rows] = await db.query(`
        SELECT branch, sgpa_division, COUNT(*) AS cnt
        FROM result_data
        WHERE programme=? AND batch=? AND semester=? AND main_status=? AND appeared='A'
        GROUP BY branch, sgpa_division`,
        [programme, batch, semester, candStatus]);

      const [totRows] = await db.query(`
        SELECT branch, COUNT(*) AS appeared,
               SUM(pf_status='P') AS pass_count
        FROM result_data
        WHERE programme=? AND batch=? AND semester=? AND main_status=? AND appeared='A'
        GROUP BY branch`,
        [programme, batch, semester, candStatus]);

      const branchMap = {}, totals = {};
      rows.forEach(r => {
        if (!branchMap[r.branch]) branchMap[r.branch] = {};
        branchMap[r.branch][r.sgpa_division] = Number(r.cnt);
      });
      totRows.forEach(r => {
        totals[r.branch] = { appeared: Number(r.appeared), pass: Number(r.pass_count) };
      });

      const branches = Object.keys(totals).sort();
      let grandApp = 0, grandPass = 0;
      const tableRows = branches.map(br => {
        const t = totals[br] || { appeared: 0, pass: 0 };
        grandApp += t.appeared; grandPass += t.pass;
        const row = { branch: br, appeared: t.appeared, pass: t.pass,
          percent: t.appeared ? ((t.pass / t.appeared) * 100).toFixed(2) : '0.00' };
        DIVS.forEach(d => { row[d] = branchMap[br]?.[d] || 0; });
        return row;
      });

      res.json({
        divisions: DIVS, rows: tableRows,
        totalAppeared: grandApp, totalPass: grandPass,
        totalPercent: grandApp ? ((grandPass / grandApp) * 100).toFixed(2) : '0.00'
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ═══════════════════════════════════════════════════════════
     5.  NBA COURSE WISE  —  /api/nba/*
  ═══════════════════════════════════════════════════════════ */

  router.get('/nba/filters', async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT DISTINCT batch, semester, branch FROM result_data_coursewise ORDER BY batch, semester`);
      res.json({
        batches:   [...new Set(rows.map(r => r.batch))],
        semesters: [...new Set(rows.map(r => r.semester))],
        branches:  [...new Set(rows.map(r => r.branch))]
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/nba/analysis', async (req, res) => {
    const { batch, semester, branch } = req.query;
    const GRADES = ['O','A+','A','B+','B','C','F','AB'];
    try {
      const [rows] = await db.query(`
        SELECT subject_name, grade, COUNT(*) AS cnt
        FROM result_data_coursewise
        WHERE batch=? AND semester=? AND branch=?
        GROUP BY subject_name, grade`,
        [batch, semester, branch]);

      const [totRows] = await db.query(`
        SELECT subject_name, COUNT(*) AS total,
               SUM(grade NOT IN ('F','AB')) AS pass_count
        FROM result_data_coursewise
        WHERE batch=? AND semester=? AND branch=?
        GROUP BY subject_name`,
        [batch, semester, branch]);

      const subjectMap = {}, totals = {};
      rows.forEach(r => {
        if (!subjectMap[r.subject_name]) subjectMap[r.subject_name] = {};
        subjectMap[r.subject_name][r.grade] = Number(r.cnt);
      });
      totRows.forEach(r => {
        totals[r.subject_name] = { total: Number(r.total), pass: Number(r.pass_count) };
      });

      const subjects = Object.keys(totals).sort();
      const tableRows = subjects.map(subj => {
        const t = totals[subj];
        const row = { subject: subj, total: t.total, pass: t.pass,
          percent: t.total ? ((t.pass / t.total) * 100).toFixed(2) : '0.00' };
        GRADES.forEach(g => { row[g] = subjectMap[subj]?.[g] || 0; });
        return row;
      });

      res.json({ grades: GRADES, rows: tableRows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ═══════════════════════════════════════════════════════════
     6.  GRADUANTS  —  /api/graduants/*
  ═══════════════════════════════════════════════════════════ */

  router.get('/graduants/filters', async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT DISTINCT programme, academic_year FROM graduants ORDER BY academic_year`);
      res.json({
        programmes:    [...new Set(rows.map(r => r.programme))],
        academicYears: [...new Set(rows.map(r => r.academic_year))]
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/graduants/analysis', async (req, res) => {
    const { programme, academicYear } = req.query;
    const DIVS = ['FIRST CLASS with DISTINCTION','FIRST CLASS','SECOND DIVISION','PASS CLASS'];
    try {
      const [rows] = await db.query(`
        SELECT branch, division, backlog_status, COUNT(*) AS cnt
        FROM graduants
        WHERE programme=? AND academic_year=?
        GROUP BY branch, division, backlog_status`,
        [programme, academicYear]);

      const branchMap = {};
      rows.forEach(r => {
        if (!branchMap[r.branch]) branchMap[r.branch] = { total: 0, withBacklog: 0, noBacklog: 0, divs: {} };
        const cnt = Number(r.cnt);
        branchMap[r.branch].total += cnt;
        if (r.backlog_status === 'Without Any Backlog') branchMap[r.branch].noBacklog += cnt;
        else branchMap[r.branch].withBacklog += cnt;
        branchMap[r.branch].divs[r.division] = (branchMap[r.branch].divs[r.division] || 0) + cnt;
      });

      const tableRows = Object.keys(branchMap).sort().map(br => {
        const b = branchMap[br];
        const row = { branch: br, total: b.total, withBacklog: b.withBacklog, noBacklog: b.noBacklog };
        DIVS.forEach(d => { row[d] = b.divs[d] || 0; });
        return row;
      });

      res.json({ divisions: DIVS, rows: tableRows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ═══════════════════════════════════════════════════════════
     7.  NOTICE / RESULT LETTER  —  /api/notice/*
  ═══════════════════════════════════════════════════════════ */

  router.get('/notice/filters', async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT DISTINCT programme, batch, semester, main_status FROM result_data ORDER BY batch, semester`);
      res.json({
        programmes: [...new Set(rows.map(r => r.programme))],
        batches:    [...new Set(rows.map(r => r.batch))],
        semesters:  [...new Set(rows.map(r => r.semester))],
        statuses:   [...new Set(rows.map(r => r.main_status))]
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/notice/data', async (req, res) => {
    const { programme, batch, semester, candStatus } = req.query;
    try {
      const [rows] = await db.query(`
        SELECT rd.roll_no, rd.branch, rd.pf_status, rd.exam_month,
               rd.sgpa_division, rd.appeared,
               cw.subject_name, cw.grade AS cw_grade
        FROM result_data rd
        LEFT JOIN result_data_coursewise cw
          ON rd.roll_no = cw.roll_no AND rd.semester = cw.semester AND rd.batch = cw.batch
        WHERE rd.programme=? AND rd.batch=? AND rd.semester=? AND rd.main_status=?
          AND rd.appeared='A'`,
        [programme, batch, semester, candStatus]);

      const DIV_MAP = {
        'Distinction':  'FIRST CLASS with DISTINCTION',
        'First Class':  'FIRST CLASS',
        'Second Class': 'SECOND DIVISION',
        'Pass':         'PASS CLASS'
      };
      const DIV_ORDER = ['FIRST CLASS with DISTINCTION','FIRST CLASS','SECOND DIVISION','PASS CLASS'];

      const branchMap = {}, failedByBranch = {}, subjFailMap = {};
      let resultMonth = '';

      rows.forEach(r => {
        const { roll_no, branch, pf_status, exam_month, sgpa_division, subject_name, cw_grade } = r;
        if (!resultMonth && exam_month) resultMonth = exam_month;
        if (!branchMap[branch]) {
          branchMap[branch] = { appeared: 0, passed: 0, divRolls: {} };
          DIV_ORDER.forEach(d => { branchMap[branch].divRolls[d] = []; });
        }
        if (!failedByBranch[branch]) failedByBranch[branch] = new Set();
        branchMap[branch].appeared++;
        if (pf_status === 'P') {
          branchMap[branch].passed++;
          const divLabel = DIV_MAP[sgpa_division];
          if (divLabel) branchMap[branch].divRolls[divLabel].push(roll_no);
        } else {
          failedByBranch[branch].add(roll_no);
          if (subject_name && (String(cw_grade).toUpperCase() === 'F' || String(cw_grade).toUpperCase() === 'AB')) {
            if (!subjFailMap[branch]) subjFailMap[branch] = {};
            if (!subjFailMap[branch][subject_name]) subjFailMap[branch][subject_name] = new Set();
            subjFailMap[branch][subject_name].add(roll_no);
          }
        }
      });

      const branches = Object.keys(branchMap).sort().map(branch => {
        const b = branchMap[branch];
        const passedPct = b.appeared ? ((b.passed / b.appeared) * 100).toFixed(1) : '0.0';
        const divisions = DIV_ORDER.map(d => ({
          label: d, count: b.divRolls[d].length,
          pct: b.appeared ? ((b.divRolls[d].length / b.appeared) * 100).toFixed(1) : '0.0',
          rolls: b.divRolls[d]
        }));
        const failSubjects = [];
        const sm = subjFailMap[branch] || {};
        const fr = failedByBranch[branch] || new Set();
        if (Object.keys(sm).length > 0) {
          Object.keys(sm).sort().forEach(subj => {
            failSubjects.push({ subject: subj, total: sm[subj].size, rolls: [...sm[subj]].sort() });
          });
        } else if (fr.size > 0) {
          failSubjects.push({ subject: 'No course-wise data', total: fr.size, rolls: [...fr].sort() });
        }
        return { branch, appeared: b.appeared, passed: b.passed, passedPct, divisions, failSubjects, totalFailed: fr.size };
      });

      res.json({ programme, batch, semester, candStatus, resultMonth: resultMonth || 'N/A', branches });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/notice/toppers', async (req, res) => {
    const { programme, batch, semester, candStatus } = req.query;
    try {
      const [rows] = await db.query(`
        SELECT roll_no, branch, sgpa, student_name
        FROM result_data
        WHERE programme=? AND batch=? AND semester=? AND main_status=?
          AND appeared='A' AND pf_status='P'
        ORDER BY sgpa DESC`,
        [programme, batch, semester, candStatus]);

      function topStudents(arr) {
        arr.sort((a, b) => b.sgpa - a.sgpa);
        const result = []; let rank = 1;
        for (let i = 0; i < arr.length; i++) {
          if (i > 0 && arr[i].sgpa !== arr[i-1].sgpa) rank = i + 1;
          if (rank > 3 && (i === 0 || arr[i].sgpa !== arr[i-1].sgpa)) break;
          result.push({ ...arr[i], sgpa: parseFloat(arr[i].sgpa).toFixed(2) });
        }
        return result;
      }

      const allPassed = rows.map(r => ({
        roll: r.roll_no, branch: r.branch, sgpa: parseFloat(r.sgpa), name: r.student_name || ''
      }));

      const branchBest = {};
      allPassed.forEach(s => {
        if (!branchBest[s.branch]) branchBest[s.branch] = [];
        branchBest[s.branch].push(s);
      });

      const branchToppers = {};
      Object.keys(branchBest).forEach(br => { branchToppers[br] = topStudents(branchBest[br]); });

      res.json({ overallToppers: topStudents([...allPassed]), branchToppers });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/notice/result-date', async (req, res) => {
    const { programme, batch, semester, candStatus } = req.query;
    try {
      const [rows] = await db.query(`
        SELECT academic_year AS ay, result_declaration_date AS resultDeclDate
        FROM result_dates
        WHERE programme=? AND batch=? AND semester=? AND candidate_status=? LIMIT 1`,
        [programme, batch, semester, candStatus]);
      if (!rows.length) return res.json({ ay: '', resultDeclDate: '' });
      const r = rows[0];
      let rdDate = '';
      if (r.resultDeclDate) {
        const d = new Date(r.resultDeclDate);
        if (!isNaN(d)) rdDate = `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
        else rdDate = String(r.resultDeclDate);
      }
      res.json({ ay: r.ay || '', resultDeclDate: rdDate });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ═══════════════════════════════════════════════════════════
     8.  ADMIN ACTIONS  —  /api/result-admin/*
  ═══════════════════════════════════════════════════════════ */

  router.post('/result-admin/update-admissions', async (req, res) => {
    try {
      await db.query(`
        UPDATE result_data rd
        INNER JOIN result_admissions adm ON rd.roll_no = adm.roll_no
        SET rd.admission_type = adm.admission_type
        WHERE adm.admission_type IS NOT NULL AND adm.admission_type != ''`);
      await db.query(`
        UPDATE result_data SET admission_type = CASE
          WHEN roll_no LIKE '%L' THEN 'Regular Lateral In Take'
          ELSE 'Regular In Take'
        END WHERE admission_type IS NULL OR admission_type = ''`);
      await db.query(`
        UPDATE result_data SET main_status = CASE
          WHEN roll_no LIKE '%L' AND (CAST(SUBSTRING(roll_no,2,2) AS UNSIGNED) - CAST(SUBSTRING(batch,3,2) AS UNSIGNED)) = 1 THEN 'Regular'
          WHEN roll_no LIKE '%L' THEN 'Repeaters'
          WHEN (CAST(SUBSTRING(roll_no,2,2) AS UNSIGNED) - CAST(SUBSTRING(batch,1,2) AS UNSIGNED) - 21) = 0 THEN 'Regular'
          ELSE 'Repeaters'
        END`);
      await db.query(`
        UPDATE result_data SET final_status = CASE
          WHEN main_status='Regular'   AND admission_type='Regular In Take'         THEN 'Regular_Regular'
          WHEN main_status='Regular'   AND admission_type='Regular Lateral In Take'  THEN 'Regular_Lateral'
          WHEN main_status='Regular'   AND admission_type='EWS'                      THEN 'Regular_EWS'
          WHEN main_status='Regular'   AND admission_type='EWS_L'                    THEN 'Regular_EWS_Lateral'
          WHEN main_status='Repeaters' AND admission_type='Regular In Take'         THEN 'Repeater-Regular'
          WHEN main_status='Repeaters' AND admission_type='Regular Lateral In Take'  THEN 'Repeater_lateral'
          WHEN main_status='Repeaters' AND admission_type='EWS'                      THEN 'Repeater-Regular_EWS'
          WHEN main_status='Repeaters' AND admission_type='EWS_L'                    THEN 'Repeater_EWS_lateral'
          ELSE final_status
        END`);
      await db.query(`
        UPDATE result_data SET
          sgpa_pct = CASE WHEN pf_status='P' THEN ROUND((sgpa - 0.5) * 10, 2) ELSE NULL END,
          sgpa_slab = CASE
            WHEN pf_status='F' THEN 'Fail'
            WHEN (sgpa-0.5)*10 >= 90 THEN 'More 90%'
            WHEN (sgpa-0.5)*10 >= 80 THEN '80-89%'
            WHEN (sgpa-0.5)*10 >= 70 THEN '70-79%'
            WHEN (sgpa-0.5)*10 >= 60 THEN '60-69%'
            WHEN (sgpa-0.5)*10 >= 50 THEN '50-59%'
            ELSE 'Less than 50'
          END`);
      res.json({ success: true, message: '✅ Admissions & Candidate Status Updated Successfully' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/result-admin/update-sgpa-cgpa', async (req, res) => {
    try {
      await db.query(`UPDATE result_data SET sgpa_division='Fail', cgpa_division='Fail', sgpa_pct=NULL, cgpa_pct=NULL WHERE pf_status='F'`);
      await db.query(`
        UPDATE result_data SET
          sgpa_pct = ROUND((sgpa - 0.5) * 10, 2),
          sgpa_division = CASE
            WHEN sgpa >= 7.50 THEN 'Distinction'
            WHEN sgpa >= 6.50 THEN 'First Class'
            WHEN sgpa >= 5.50 THEN 'Second Class'
            WHEN sgpa >= 4.50 THEN 'Pass'
            ELSE 'Fail'
          END
        WHERE pf_status='P'`);
      await db.query(`UPDATE result_data SET sgpa_division='Pass' WHERE pf_status='P' AND sgpa_division='Fail'`);
      await db.query(`
        UPDATE result_data SET
          cgpa_pct = ROUND((cgpa - 0.5) * 10, 2),
          cgpa_division = CASE
            WHEN cgpa >= 7.50 THEN 'Distinction'
            WHEN cgpa >= 6.50 THEN 'First Class'
            WHEN cgpa >= 5.50 THEN 'Second Class'
            WHEN cgpa >= 4.50 THEN 'Pass'
            ELSE 'Fail'
          END
        WHERE pf_status='P'`);
      await db.query(`UPDATE result_data SET cgpa_division='Pass' WHERE pf_status='P' AND cgpa_division='Fail'`);
      res.json({ success: true, message: '✅ SGPA & CGPA Division Classification Updated' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/result-admin/update-backlog-status', async (req, res) => {
    try {
      await db.query(`
        UPDATE graduants g
        SET backlog_status = CASE
          WHEN EXISTS (SELECT 1 FROM result_data rd WHERE rd.roll_no = g.htno AND rd.pf_status != 'P')
          THEN 'With Backlog'
          ELSE 'Without Any Backlog'
        END`);
      res.json({ success: true, message: '✅ Graduants Backlog Status Updated Successfully' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ═══════════════════════════════════════════════════════════
     9.  RESULT DATES CRUD  —  /api/result-dates/*
  ═══════════════════════════════════════════════════════════ */

  router.get('/result-dates', async (req, res) => {
    try {
      const [rows] = await db.query(`SELECT * FROM result_dates ORDER BY batch, semester`);
      res.json({ success: true, data: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/result-dates', async (req, res) => {
    const { programme, batch, semester, result_declaration_date, academic_year, candidate_status } = req.body;
    try {
      await db.query(`
        INSERT INTO result_dates (programme, batch, semester, result_declaration_date, academic_year, candidate_status)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE result_declaration_date=VALUES(result_declaration_date), academic_year=VALUES(academic_year)`,
        [programme, batch, semester, result_declaration_date, academic_year, candidate_status]);
      res.json({ success: true, message: 'Result date saved' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
}

module.exports = { initializeRouter };
