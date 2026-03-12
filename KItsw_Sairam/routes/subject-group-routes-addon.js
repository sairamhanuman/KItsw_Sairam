// ============================================================
//  subject-group-routes-addon.js
//  ADD THESE ROUTES to your existing subject routes file
//  (paste before module.exports)
//
//  New endpoints:
//    GET  /api/subjects/group-codes          → all unique group codes
//    PATCH /api/subjects/:id/group-code      → update single subject
//    POST /api/subjects/bulk-assign-group    → assign group to many
//    GET  /api/subjects/group-summary        → stats per group
// ============================================================

// GET /api/subjects/group-codes
// Returns all unique subject_group_codes currently in use
router.get('/subjects/group-codes', async (req, res) => {
    try {
        const [rows] = await promisePool.query(`
            SELECT
                subject_group_code                          AS group_code,
                COUNT(*)                                    AS subject_count,
                GROUP_CONCAT(DISTINCT syllabus_code
                    ORDER BY syllabus_code
                    SEPARATOR ', '
                    LIMIT 5)                               AS sample_codes,
                GROUP_CONCAT(DISTINCT subject_name
                    ORDER BY subject_name
                    SEPARATOR ' | '
                    LIMIT 3)                               AS sample_names
            FROM subject_master
            WHERE subject_group_code IS NOT NULL
              AND subject_group_code != ''
              AND is_active = 1
            GROUP BY subject_group_code
            ORDER BY subject_group_code
        `);
        res.json({ status: 'success', data: rows });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// GET /api/subjects/group-summary
// Full summary: which subjects are ungrouped, grouped, conflicts
router.get('/subjects/group-summary', async (req, res) => {
    try {
        const { programme_id, branch_id, semester_id, regulation_id } = req.query;
        let where = 'WHERE s.is_active = 1';
        const params = [];
        if (programme_id)  { where += ' AND s.programme_id = ?';  params.push(programme_id); }
        if (branch_id)     { where += ' AND s.branch_id = ?';     params.push(branch_id); }
        if (semester_id)   { where += ' AND s.semester_id = ?';   params.push(semester_id); }
        if (regulation_id) { where += ' AND s.regulation_id = ?'; params.push(regulation_id); }

        const [rows] = await promisePool.query(`
            SELECT
                s.subject_id,
                s.syllabus_code,
                s.subject_name,
                s.subject_group_code,
                b.branch_code,
                sem.semester_name
            FROM subject_master s
            LEFT JOIN branch_master b ON b.branch_id = s.branch_id
            LEFT JOIN semester_master sem ON sem.semester_id = s.semester_id
            ${where}
            ORDER BY s.subject_name, b.branch_code
        `, params);

        const grouped   = rows.filter(r => r.subject_group_code);
        const ungrouped = rows.filter(r => !r.subject_group_code);

        // Detect subjects with same name but different group codes (conflict)
        const nameMap = {};
        rows.forEach(r => {
            const key = r.subject_name.toUpperCase().trim();
            if (!nameMap[key]) nameMap[key] = new Set();
            if (r.subject_group_code) nameMap[key].add(r.subject_group_code);
        });
        const conflicts = Object.entries(nameMap)
            .filter(([, codes]) => codes.size > 1)
            .map(([name, codes]) => ({ subject_name: name, group_codes: [...codes] }));

        res.json({
            status: 'success',
            total: rows.length,
            grouped: grouped.length,
            ungrouped: ungrouped.length,
            conflicts: conflicts.length,
            conflict_details: conflicts,
            ungrouped_subjects: ungrouped,
            data: rows
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// PATCH /api/subjects/:id/group-code
// Update group code for a single subject
router.patch('/subjects/:id/group-code', async (req, res) => {
    try {
        const { group_code } = req.body;
        const code = group_code ? group_code.toUpperCase().trim() : null;

        await promisePool.query(
            `UPDATE subject_master SET subject_group_code = ? WHERE subject_id = ?`,
            [code, req.params.id]
        );

        // Return updated subject
        const [[subject]] = await promisePool.query(
            `SELECT subject_id, subject_name, syllabus_code, subject_group_code FROM subject_master WHERE subject_id = ?`,
            [req.params.id]
        );

        res.json({ status: 'success', message: 'Group code updated', data: subject });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// POST /api/subjects/bulk-assign-group
// Assign group code to multiple subjects at once
// Body: { subject_ids: [1,2,3], group_code: "DS" }
// OR:   { match_name: "Data Structures", group_code: "DS" }  ← fuzzy match
router.post('/subjects/bulk-assign-group', async (req, res) => {
    try {
        const { subject_ids, match_name, group_code } = req.body;
        if (!group_code) return res.status(400).json({ status: 'error', message: 'group_code required' });

        const code = group_code.toUpperCase().trim();
        let affected = 0;

        if (subject_ids && subject_ids.length > 0) {
            // Direct ID assignment
            const ph = subject_ids.map(() => '?').join(',');
            const [result] = await promisePool.query(
                `UPDATE subject_master SET subject_group_code = ? WHERE subject_id IN (${ph})`,
                [code, ...subject_ids]
            );
            affected = result.affectedRows;

        } else if (match_name) {
            // Fuzzy name match
            const [result] = await promisePool.query(
                `UPDATE subject_master
                 SET subject_group_code = ?
                 WHERE is_active = 1
                   AND UPPER(TRIM(subject_name)) LIKE UPPER(TRIM(?))`,
                [code, `%${match_name}%`]
            );
            affected = result.affectedRows;
        } else {
            return res.status(400).json({ status: 'error', message: 'Provide subject_ids or match_name' });
        }

        res.json({
            status: 'success',
            message: `Group code "${code}" assigned to ${affected} subject(s)`,
            affected
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// POST /api/subjects/auto-group
// Smart auto-grouping: finds subjects with similar names and suggests group codes
// Uses SOUNDEX + LIKE matching
router.post('/subjects/auto-group', async (req, res) => {
    try {
        // Find all ungrouped subjects
        const [ungrouped] = await promisePool.query(`
            SELECT subject_id, subject_name, syllabus_code, subject_group_code
            FROM subject_master
            WHERE is_active = 1
              AND (subject_group_code IS NULL OR subject_group_code = '')
            ORDER BY subject_name
        `);

        // Find all existing groups for reference
        const [existing] = await promisePool.query(`
            SELECT DISTINCT subject_group_code, subject_name
            FROM subject_master
            WHERE subject_group_code IS NOT NULL
              AND subject_group_code != ''
              AND is_active = 1
        `);

        // Build suggestions: normalize name → suggest group code
        const suggestions = ungrouped.map(s => {
            const normalised = s.subject_name.toUpperCase().trim();

            // Check if any existing grouped subject has similar name
            const match = existing.find(e => {
                const en = e.subject_name.toUpperCase().trim();
                // Exact match or one contains the other
                return en === normalised ||
                    en.includes(normalised.substring(0, 10)) ||
                    normalised.includes(en.substring(0, 10));
            });

            // Auto-generate code from first letters of words
            const autoCode = s.subject_name
                .split(/\s+/)
                .filter(w => w.length > 2)
                .slice(0, 3)
                .map(w => w[0].toUpperCase())
                .join('');

            return {
                subject_id:    s.subject_id,
                subject_name:  s.subject_name,
                syllabus_code: s.syllabus_code,
                suggested_group: match ? match.subject_group_code : autoCode,
                match_source:    match ? 'existing_match' : 'auto_generated'
            };
        });

        res.json({
            status: 'success',
            total_ungrouped: ungrouped.length,
            suggestions
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ── GET /api/subjects/:id  (ensure group code is returned) ──
// Your existing GET route should already return all columns.
// If not, confirm your SELECT includes subject_group_code.
