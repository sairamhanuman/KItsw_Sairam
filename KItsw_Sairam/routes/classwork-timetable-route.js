'use strict';
// ============================================================
// routes/classwork-timetable-route.js
// Classwork Timetable Module — All API Endpoints
// v2 — added semester_type + room setup
// ============================================================

const express = require('express');

function initializeRouter(promisePool) {
    const router = express.Router();

    // ─── CONSTANTS ────────────────────────────────────────────────────────────
    const PERIODS = [
        { period_no: 1, label: '09:40–10:30' },
        { period_no: 2, label: '10:30–11:20' },
        { period_no: 3, label: '11:20–12:10' },
        { period_no: 4, label: '12:10–13:00' },
        { period_no: 5, label: '14:00–14:50' },
        { period_no: 6, label: '14:50–15:40' },
        { period_no: 7, label: '15:40–16:30' },
    ];
    const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    // ── GET /periods ──────────────────────────────────────────────────────────
    router.get('/periods', (req, res) => {
        res.json({ status: 'success', data: PERIODS });
    });

    // ── GET /filter-data ──────────────────────────────────────────────────────
    router.get('/filter-data', async (req, res) => {
        try {
            const [programmes] = await promisePool.query(
                `SELECT programme_id, programme_code, programme_name FROM programme_master WHERE is_active=1 ORDER BY programme_name`
            );
            const [branches] = await promisePool.query(
                `SELECT branch_id, branch_code, branch_name, programme_id FROM branch_master WHERE is_active=1 ORDER BY branch_name`
            );
            const [semesters] = await promisePool.query(
                `SELECT semester_id, semester_name, semester_number FROM semester_master WHERE is_active=1 ORDER BY semester_number`
            );
            const [sections] = await promisePool.query(
                `SELECT section_id, section_name FROM section_master WHERE is_active=1 ORDER BY section_name`
            );
            const [regulations] = await promisePool.query(
                `SELECT regulation_id, regulation_name FROM regulation_master WHERE is_active=1 ORDER BY regulation_name DESC`
            );
            const [batches] = await promisePool.query(
                `SELECT batch_id, batch_name FROM batch_master WHERE is_active=1 ORDER BY batch_name`
            );
            const [staff] = await promisePool.query(
                `SELECT staff_id, employee_id, CONCAT(title_prefix,' ',full_name) AS full_name, department_id
                 FROM staff_master WHERE is_active=1 AND employment_status='Active' ORDER BY full_name`
            );
            res.json({ status: 'success', data: { programmes, branches, semesters, sections, regulations, batches, staff } });
        } catch (err) {
            console.error('filter-data error:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    // ── GET /allotted-courses ─────────────────────────────────────────────────
    router.get('/allotted-courses', async (req, res) => {
        const { programme_id, branch_id, semester_id, section_id, regulation_id } = req.query;
        if (!programme_id || !branch_id || !semester_id || !section_id) {
            return res.status(400).json({ status: 'error', message: 'Missing required filters' });
        }
        try {
            const [rows] = await promisePool.query(
                `SELECT
                    sfa.allotment_id,
                    sm.subject_id,
                    sm.ref_code          AS subject_short,
                    sm.syllabus_code,
                    sm.subject_name,
                    sm.subject_type,
                    sm.credits,
                    st.staff_id,
                    st.employee_id,
                    CONCAT(st.title_prefix,' ',st.full_name) AS faculty_name,
                    sec.section_name,
                    sem.semester_name,
                    bm.batch_name
                FROM subject_faculty_allotment sfa
                JOIN subject_master  sm  ON sfa.subject_id  = sm.subject_id
                JOIN staff_master    st  ON sfa.staff_id    = st.staff_id
                JOIN section_master  sec ON sfa.section_id  = sec.section_id
                JOIN semester_master sem ON sfa.semester_id = sem.semester_id
                LEFT JOIN batch_master bm ON sfa.batch_id   = bm.batch_id
                WHERE sfa.programme_id = ?
                  AND sfa.branch_id    = ?
                  AND sfa.semester_id  = ?
                  AND sfa.section_id   = ?
                  AND sfa.is_active    = 1
                  AND sfa.deleted_at   IS NULL
                ${regulation_id ? 'AND sfa.regulation_id = ?' : ''}
                ORDER BY sm.subject_order, sm.subject_name`,
                regulation_id
                    ? [programme_id, branch_id, semester_id, section_id, regulation_id]
                    : [programme_id, branch_id, semester_id, section_id]
            );
            res.json({ status: 'success', data: rows });
        } catch (err) {
            console.error('allotted-courses error:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    // ══════════════════════════════════════════════════════════════════════════
    // ROOM SETUP ENDPOINTS
    // ══════════════════════════════════════════════════════════════════════════

    // ── GET /room-setup ───────────────────────────────────────────────────────
    // Fetch saved room setup for a given filter combination
    router.get('/room-setup', async (req, res) => {
        const { programme_id, branch_id, semester_id, section_id, academic_year, semester_type } = req.query;
        if (!programme_id || !branch_id || !semester_id || !section_id || !academic_year || !semester_type) {
            return res.status(400).json({ status: 'error', message: 'Missing required filters' });
        }
        try {
            const [rows] = await promisePool.query(
                `SELECT setup_id, room_no, room_role, display_order
                 FROM classwork_room_setup
                 WHERE programme_id=? AND branch_id=? AND semester_id=?
                   AND section_id=? AND academic_year=? AND semester_type=?
                   AND is_active=1
                 ORDER BY room_role DESC, display_order ASC`,
                [programme_id, branch_id, semester_id, section_id, academic_year, semester_type]
            );
            const main = rows.filter(r => r.room_role === 'Main');
            const sub  = rows.filter(r => r.room_role === 'Sub');
            res.json({ status: 'success', data: { main, sub, all: rows } });
        } catch (err) {
            console.error('room-setup GET error:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    // ── POST /room-setup/save ─────────────────────────────────────────────────
    // Save (replace) room setup for a filter combination
    router.post('/room-setup/save', async (req, res) => {
        const { programme_id, branch_id, semester_id, section_id,
                academic_year, semester_type, main_rooms, sub_rooms } = req.body;

        if (!programme_id || !branch_id || !semester_id || !section_id || !academic_year || !semester_type) {
            return res.status(400).json({ status: 'error', message: 'Missing required fields' });
        }
        if (!main_rooms || main_rooms.length === 0) {
            return res.status(400).json({ status: 'error', message: 'At least one Main room is required' });
        }
        if (main_rooms.length > 2) {
            return res.status(400).json({ status: 'error', message: 'Maximum 2 Main rooms are allowed' });
        }

        const conn = await promisePool.getConnection();
        try {
            await conn.beginTransaction();

            // Delete existing setup for this combination
            await conn.query(
                `DELETE FROM classwork_room_setup
                 WHERE programme_id=? AND branch_id=? AND semester_id=?
                   AND section_id=? AND academic_year=? AND semester_type=?`,
                [programme_id, branch_id, semester_id, section_id, academic_year, semester_type]
            );

            // Insert main rooms
            const rows = [];
            main_rooms.forEach((room, i) => {
                if (room && room.trim()) {
                    rows.push([programme_id, branch_id, semester_id, section_id,
                               academic_year, semester_type, room.trim(), 'Main', i + 1]);
                }
            });

            // Insert sub rooms
            (sub_rooms || []).forEach((room, i) => {
                if (room && room.trim()) {
                    rows.push([programme_id, branch_id, semester_id, section_id,
                               academic_year, semester_type, room.trim(), 'Sub', i + 1]);
                }
            });

            if (rows.length > 0) {
                await conn.query(
                    `INSERT INTO classwork_room_setup
                        (programme_id,branch_id,semester_id,section_id,academic_year,semester_type,room_no,room_role,display_order)
                     VALUES ?`,
                    [rows]
                );
            }

            await conn.commit();
            res.json({ status: 'success', message: 'Room setup saved successfully', total: rows.length });
        } catch (err) {
            await conn.rollback();
            console.error('room-setup save error:', err);
            res.status(500).json({ status: 'error', message: err.message });
        } finally {
            conn.release();
        }
    });

    // ── GET /room-setup/auto-rooms ────────────────────────────────────────────
    // Called when timetable filters are selected — returns main room(s) for auto-fill
    router.get('/room-setup/auto-rooms', async (req, res) => {
        const { programme_id, branch_id, semester_id, section_id, academic_year, semester_type } = req.query;
        if (!programme_id || !branch_id || !semester_id || !section_id) {
            return res.json({ status: 'success', data: { main_rooms: [], sub_rooms: [] } });
        }
        try {
            let query = `SELECT room_no, room_role FROM classwork_room_setup
                         WHERE programme_id=? AND branch_id=? AND semester_id=? AND section_id=? AND is_active=1`;
            const params = [programme_id, branch_id, semester_id, section_id];
            if (academic_year)  { query += ' AND academic_year=?';  params.push(academic_year); }
            if (semester_type)  { query += ' AND semester_type=?';  params.push(semester_type); }
            query += ' ORDER BY room_role DESC, display_order ASC';

            const [rows] = await promisePool.query(query, params);
            res.json({
                status: 'success',
                data: {
                    main_rooms: rows.filter(r => r.room_role === 'Main').map(r => r.room_no),
                    sub_rooms:  rows.filter(r => r.room_role === 'Sub').map(r => r.room_no),
                    all_rooms:  rows.map(r => r.room_no)
                }
            });
        } catch (err) {
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    // ── GET /room-setup/list ──────────────────────────────────────────────────
    // All saved room setups (for management view)
    router.get('/room-setup/list', async (req, res) => {
        try {
            const [rows] = await promisePool.query(
                `SELECT rs.*,
                    p.programme_name, p.programme_code,
                    b.branch_name, b.branch_code,
                    sm.semester_name, sm.semester_number,
                    sec.section_name
                 FROM classwork_room_setup rs
                 JOIN programme_master p   ON rs.programme_id = p.programme_id
                 JOIN branch_master    b   ON rs.branch_id    = b.branch_id
                 JOIN semester_master  sm  ON rs.semester_id  = sm.semester_id
                 JOIN section_master   sec ON rs.section_id   = sec.section_id
                 WHERE rs.is_active=1
                 ORDER BY rs.academic_year DESC, b.branch_name, sm.semester_number, sec.section_name, rs.room_role DESC`
            );
            res.json({ status: 'success', data: rows });
        } catch (err) {
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    // ── DELETE /room-setup/delete ─────────────────────────────────────────────
    router.post('/room-setup/delete', async (req, res) => {
        const { programme_id, branch_id, semester_id, section_id, academic_year, semester_type } = req.body;
        if (!programme_id || !branch_id || !semester_id || !section_id || !academic_year || !semester_type) {
            return res.status(400).json({ status: 'error', message: 'Missing required fields' });
        }
        try {
            await promisePool.query(
                `DELETE FROM classwork_room_setup
                 WHERE programme_id=? AND branch_id=? AND semester_id=? AND section_id=?
                   AND academic_year=? AND semester_type=?`,
                [programme_id, branch_id, semester_id, section_id, academic_year, semester_type]
            );
            res.json({ status: 'success', message: 'Room setup deleted' });
        } catch (err) {
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    // ── GET /rooms-by-block ───────────────────────────────────────────────────
    // Returns all active rooms grouped by block — for the visual room picker
    router.get('/rooms-by-block', async (req, res) => {
        try {
            const [rooms] = await promisePool.query(
                `SELECT
                    r.room_id,
                    r.room_code,
                    r.room_name,
                    r.room_type,
                    r.floor_number,
                    r.total_capacity,
                    r.has_projector,
                    r.has_ac,
                    b.block_id,
                    b.block_code,
                    b.block_name
                FROM room_master r
                JOIN block_master b ON r.block_id = b.block_id
                WHERE r.is_active = 1
                  AND r.deleted_at IS NULL
                  AND b.is_active  = 1
                  AND b.deleted_at IS NULL
                ORDER BY b.block_name, r.floor_number, r.room_code`
            );

            // Group by block
            const grouped = {};
            rooms.forEach(r => {
                const key = r.block_id;
                if (!grouped[key]) {
                    grouped[key] = {
                        block_id:   r.block_id,
                        block_code: r.block_code,
                        block_name: r.block_name,
                        rooms: []
                    };
                }
                grouped[key].rooms.push({
                    room_id:       r.room_id,
                    room_code:     r.room_code,
                    room_name:     r.room_name,
                    room_type:     r.room_type,
                    floor_number:  r.floor_number,
                    total_capacity:r.total_capacity,
                    has_projector: r.has_projector,
                    has_ac:        r.has_ac
                });
            });

            res.json({ status: 'success', data: Object.values(grouped) });
        } catch (err) {
            console.error('rooms-by-block error:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    // ══════════════════════════════════════════════════════════════════════════
    // TIMETABLE SAVE / VIEW / CLASH / WORKLOAD
    // ══════════════════════════════════════════════════════════════════════════

    // ── POST /save ────────────────────────────────────────────────────────────
    router.post('/save', async (req, res) => {
        const conn = await promisePool.getConnection();
        try {
            await conn.beginTransaction();
            const {
                programme_id, branch_id, semester_id, regulation_id,
                section_id, batch_id, room_no, academic_year, semester_type,
                effective_from, class_teacher_id, slots, courses
            } = req.body;

            // Upsert header
            const [existing] = await conn.query(
                `SELECT header_id FROM classwork_timetable_header
                 WHERE programme_id=? AND branch_id=? AND semester_id=? AND section_id=? AND regulation_id=? AND academic_year=?`,
                [programme_id, branch_id, semester_id, section_id, regulation_id, academic_year]
            );

            let header_id;
            if (existing.length > 0) {
                header_id = existing[0].header_id;
                await conn.query(
                    `UPDATE classwork_timetable_header SET
                        batch_id=?, room_no=?, semester_type=?, effective_from=?, class_teacher_id=?, updated_at=NOW()
                     WHERE header_id=?`,
                    [batch_id||null, room_no||null, semester_type||'Even', effective_from||null, class_teacher_id||null, header_id]
                );
            } else {
                const [ins] = await conn.query(
                    `INSERT INTO classwork_timetable_header
                        (programme_id,branch_id,semester_id,regulation_id,section_id,batch_id,room_no,academic_year,semester_type,effective_from,class_teacher_id)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
                    [programme_id, branch_id, semester_id, regulation_id, section_id,
                     batch_id||null, room_no||null, academic_year, semester_type||'Even',
                     effective_from||null, class_teacher_id||null]
                );
                header_id = ins.insertId;
            }

            // Replace slots
            await conn.query(`DELETE FROM classwork_timetable_slots WHERE header_id=?`, [header_id]);
            if (slots && slots.length > 0) {
                const slotRows = slots.map(s => [
                    header_id, s.day_name, s.period_no, s.course_type||'Theory',
                    s.subject_id||null, s.staff_id||null, s.room_no||null,
                    s.subject_id_b1||null, s.staff_id_b1||null, s.room_no_b1||null,
                    s.subject_id_b2||null, s.staff_id_b2||null, s.room_no_b2||null,
                    s.remarks||null
                ]);
                await conn.query(
                    `INSERT INTO classwork_timetable_slots
                        (header_id,day_name,period_no,course_type,
                         subject_id,staff_id,room_no,
                         subject_id_b1,staff_id_b1,room_no_b1,
                         subject_id_b2,staff_id_b2,room_no_b2,remarks)
                     VALUES ?`,
                    [slotRows]
                );
            }

            // Replace courses legend
            await conn.query(`DELETE FROM classwork_timetable_courses WHERE header_id=?`, [header_id]);
            if (courses && courses.length > 0) {
                const courseRows = courses.map((c, i) => [header_id, c.subject_id, c.staff_id, i + 1]);
                await conn.query(
                    `INSERT INTO classwork_timetable_courses (header_id,subject_id,staff_id,display_order) VALUES ?`,
                    [courseRows]
                );
            }

            await conn.commit();
            res.json({ status: 'success', message: 'Timetable saved successfully', header_id });
        } catch (err) {
            await conn.rollback();
            console.error('save error:', err);
            res.status(500).json({ status: 'error', message: err.message });
        } finally {
            conn.release();
        }
    });

    // ── GET /view ─────────────────────────────────────────────────────────────
    router.get('/view', async (req, res) => {
        const { programme_id, branch_id, semester_id, section_id, regulation_id, academic_year, semester_type } = req.query;
        if (!programme_id || !branch_id || !semester_id || !section_id) {
            return res.status(400).json({ status: 'error', message: 'Missing required filters' });
        }
        try {
            let hQuery = `SELECT h.*,
                    p.programme_name, p.programme_code,
                    b.branch_name, b.branch_code,
                    sm.semester_name, sm.semester_number,
                    sec.section_name,
                    r.regulation_name,
                    CONCAT(st.title_prefix,' ',st.full_name) AS class_teacher_name
                FROM classwork_timetable_header h
                JOIN programme_master p   ON h.programme_id  = p.programme_id
                JOIN branch_master    b   ON h.branch_id     = b.branch_id
                JOIN semester_master  sm  ON h.semester_id   = sm.semester_id
                JOIN section_master   sec ON h.section_id    = sec.section_id
                JOIN regulation_master r  ON h.regulation_id = r.regulation_id
                LEFT JOIN staff_master st ON h.class_teacher_id = st.staff_id
                WHERE h.programme_id=? AND h.branch_id=? AND h.semester_id=? AND h.section_id=?`;
            const hParams = [programme_id, branch_id, semester_id, section_id];
            if (regulation_id)  { hQuery += ' AND h.regulation_id=?';  hParams.push(regulation_id); }
            if (academic_year)  { hQuery += ' AND h.academic_year=?';  hParams.push(academic_year); }
            if (semester_type)  { hQuery += ' AND h.semester_type=?';  hParams.push(semester_type); }
            hQuery += ' ORDER BY h.created_at DESC LIMIT 1';

            const [headers] = await promisePool.query(hQuery, hParams);
            if (headers.length === 0) {
                return res.json({ status: 'success', data: null, message: 'No timetable found' });
            }
            const header = headers[0];

            const [slots] = await promisePool.query(
                `SELECT s.*,
                    sub.ref_code AS subject_short, sub.syllabus_code, sub.subject_name, sub.subject_type,
                    st.employee_id AS staff_emp_id,
                    CONCAT(st.title_prefix,' ',st.full_name) AS staff_name,
                    sub1.ref_code AS subject_short_b1, sub1.syllabus_code AS syllabus_code_b1, sub1.subject_name AS subject_name_b1,
                    st1.employee_id AS staff_emp_id_b1, CONCAT(st1.title_prefix,' ',st1.full_name) AS staff_name_b1,
                    sub2.ref_code AS subject_short_b2, sub2.syllabus_code AS syllabus_code_b2, sub2.subject_name AS subject_name_b2,
                    st2.employee_id AS staff_emp_id_b2, CONCAT(st2.title_prefix,' ',st2.full_name) AS staff_name_b2
                FROM classwork_timetable_slots s
                LEFT JOIN subject_master sub  ON s.subject_id    = sub.subject_id
                LEFT JOIN staff_master   st   ON s.staff_id      = st.staff_id
                LEFT JOIN subject_master sub1 ON s.subject_id_b1 = sub1.subject_id
                LEFT JOIN staff_master   st1  ON s.staff_id_b1   = st1.staff_id
                LEFT JOIN subject_master sub2 ON s.subject_id_b2 = sub2.subject_id
                LEFT JOIN staff_master   st2  ON s.staff_id_b2   = st2.staff_id
                WHERE s.header_id=?
                ORDER BY FIELD(s.day_name,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'), s.period_no`,
                [header.header_id]
            );

            const [courses] = await promisePool.query(
                `SELECT c.*,
                    sub.ref_code AS subject_short, sub.syllabus_code, sub.subject_name, sub.subject_type,
                    st.employee_id,
                    CONCAT(st.title_prefix,' ',st.full_name) AS faculty_name
                FROM classwork_timetable_courses c
                JOIN subject_master sub ON c.subject_id = sub.subject_id
                JOIN staff_master   st  ON c.staff_id   = st.staff_id
                WHERE c.header_id=?
                ORDER BY c.display_order`,
                [header.header_id]
            );

            res.json({ status: 'success', data: { header, slots, courses, periods: PERIODS, days: DAYS } });
        } catch (err) {
            console.error('view error:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    // ── GET /clash-check ──────────────────────────────────────────────────────
    router.get('/clash-check', async (req, res) => {
        const { day_name, period_no, staff_id, room_no, exclude_header_id } = req.query;
        try {
            const results = { staff_clash: false, room_clash: false, details: [] };
            if (staff_id) {
                const [sc] = await promisePool.query(
                    `SELECT h.header_id, b.branch_name, sm.semester_name, sec.section_name, sub.ref_code, s.course_type
                     FROM classwork_timetable_slots s
                     JOIN classwork_timetable_header h ON s.header_id = h.header_id
                     JOIN branch_master b   ON h.branch_id   = b.branch_id
                     JOIN semester_master sm ON h.semester_id = sm.semester_id
                     JOIN section_master sec ON h.section_id  = sec.section_id
                     LEFT JOIN subject_master sub ON s.subject_id = sub.subject_id
                     WHERE s.day_name=? AND s.period_no=? AND h.is_active=1
                       AND (s.staff_id=? OR s.staff_id_b1=? OR s.staff_id_b2=?)
                       ${exclude_header_id ? 'AND h.header_id != ?' : ''}`,
                    exclude_header_id
                        ? [day_name, period_no, staff_id, staff_id, staff_id, exclude_header_id]
                        : [day_name, period_no, staff_id, staff_id, staff_id]
                );
                if (sc.length > 0) { results.staff_clash = true; results.details.push({ type:'STAFF', clashes: sc }); }
            }
            if (room_no) {
                const [rc] = await promisePool.query(
                    `SELECT h.header_id, b.branch_name, sm.semester_name, sec.section_name
                     FROM classwork_timetable_slots s
                     JOIN classwork_timetable_header h ON s.header_id = h.header_id
                     JOIN branch_master b   ON h.branch_id   = b.branch_id
                     JOIN semester_master sm ON h.semester_id = sm.semester_id
                     JOIN section_master sec ON h.section_id  = sec.section_id
                     WHERE s.day_name=? AND s.period_no=? AND h.is_active=1
                       AND (s.room_no=? OR s.room_no_b1=? OR s.room_no_b2=?)
                       ${exclude_header_id ? 'AND h.header_id != ?' : ''}`,
                    exclude_header_id
                        ? [day_name, period_no, room_no, room_no, room_no, exclude_header_id]
                        : [day_name, period_no, room_no, room_no, room_no]
                );
                if (rc.length > 0) { results.room_clash = true; results.details.push({ type:'ROOM', clashes: rc }); }
            }
            res.json({ status: 'success', data: results });
        } catch (err) {
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    // ── GET /faculty-workload ──────────────────────────────────────────────────
    router.get('/faculty-workload', async (req, res) => {
        const { programme_id, branch_id, semester_id, section_id } = req.query;
        try {
            const [rows] = await promisePool.query(
                `SELECT st.staff_id, st.employee_id,
                    CONCAT(st.title_prefix,' ',st.full_name) AS faculty_name,
                    COUNT(CASE WHEN s.course_type='Theory'    AND s.staff_id=st.staff_id THEN 1 END) AS theory_hours,
                    COUNT(CASE WHEN s.course_type='Practical' AND (s.staff_id_b1=st.staff_id OR s.staff_id_b2=st.staff_id) THEN 1 END) AS lab_hours,
                    COUNT(CASE WHEN s.course_type='Tutorial'  AND (s.staff_id_b1=st.staff_id OR s.staff_id_b2=st.staff_id) THEN 1 END) AS tutorial_hours
                FROM classwork_timetable_header h
                JOIN classwork_timetable_slots s ON s.header_id = h.header_id
                JOIN staff_master st ON (st.staff_id=s.staff_id OR st.staff_id=s.staff_id_b1 OR st.staff_id=s.staff_id_b2)
                WHERE h.programme_id=? AND h.branch_id=? AND h.semester_id=? AND h.section_id=? AND h.is_active=1
                GROUP BY st.staff_id ORDER BY faculty_name`,
                [programme_id, branch_id, semester_id, section_id]
            );
            res.json({ status: 'success', data: rows });
        } catch (err) {
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    // ── GET /list ─────────────────────────────────────────────────────────────
    router.get('/list', async (req, res) => {
        try {
            const [rows] = await promisePool.query(
                `SELECT h.header_id, h.academic_year, h.semester_type, h.effective_from, h.room_no,
                    p.programme_name, b.branch_name, sm.semester_name, sec.section_name, r.regulation_name,
                    CONCAT(st.title_prefix,' ',st.full_name) AS class_teacher_name, h.created_at
                FROM classwork_timetable_header h
                JOIN programme_master p   ON h.programme_id  = p.programme_id
                JOIN branch_master    b   ON h.branch_id     = b.branch_id
                JOIN semester_master  sm  ON h.semester_id   = sm.semester_id
                JOIN section_master   sec ON h.section_id    = sec.section_id
                JOIN regulation_master r  ON h.regulation_id = r.regulation_id
                LEFT JOIN staff_master st ON h.class_teacher_id = st.staff_id
                WHERE h.is_active=1 ORDER BY h.created_at DESC`
            );
            res.json({ status: 'success', data: rows });
        } catch (err) {
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    return router;
}

module.exports = { initializeRouter };
