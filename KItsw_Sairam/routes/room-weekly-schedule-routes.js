// ============================================================
//  room-weekly-schedule-routes.js
//
//  GET  /api/room-schedule          → full grid (all rooms × 14 sessions)
//  POST /api/room-schedule/toggle   → toggle one cell green↔red
//  POST /api/room-schedule/reset    → set all cells FREE for one room
//  GET  /api/room-schedule/blocked-sessions?date=YYYY-MM-DD
//       → returns which room_ids are blocked for that date's day
// ============================================================

const express = require('express');

// Day column map: JS getDay() → [FN_col, AN_col]
const DAY_COLS = {
    0: ['sun_fn', 'sun_an'],  // Sunday
    1: ['mon_fn', 'mon_an'],  // Monday
    2: ['tue_fn', 'tue_an'],  // Tuesday
    3: ['wed_fn', 'wed_an'],  // Wednesday
    4: ['thu_fn', 'thu_an'],  // Thursday
    5: ['fri_fn', 'fri_an'],  // Friday
    6: ['sat_fn', 'sat_an'],  // Saturday
};

// All 14 session columns in display order
const ALL_COLS = [
    'mon_fn','mon_an',
    'tue_fn','tue_an',
    'wed_fn','wed_an',
    'thu_fn','thu_an',
    'fri_fn','fri_an',
    'sat_fn','sat_an',
    'sun_fn','sun_an'
];

const COL_LABELS = {
    mon_fn:'MON FN', mon_an:'MON AN',
    tue_fn:'TUE FN', tue_an:'TUE AN',
    wed_fn:'WED FN', wed_an:'WED AN',
    thu_fn:'THU FN', thu_an:'THU AN',
    fri_fn:'FRI FN', fri_an:'FRI AN',
    sat_fn:'SAT FN', sat_an:'SAT AN',
    sun_fn:'SUN FN', sun_an:'SUN AN'
};

// Given a date string YYYY-MM-DD and session_order (1=FN,2=AN),
// returns the column name e.g. "mon_fn"
function dateToCol(dateStr, sessionOrder) {
    // Use noon UTC to avoid timezone day-shift
    const d = new Date(dateStr + 'T12:00:00Z');
    const dayIdx = d.getUTCDay();              // 0=Sun … 6=Sat
    const cols = DAY_COLS[dayIdx];
    return cols[parseInt(sessionOrder) === 1 ? 0 : 1];
}

function initializeRouter(pool) {
    const router = express.Router();

    // ── Auto-create missing schedule rows (safe to call repeatedly)
    async function ensureScheduleRows() {
        await pool.promise().query(`
            INSERT IGNORE INTO room_weekly_schedule (room_id)
            SELECT room_id FROM room_master WHERE deleted_at IS NULL
        `);
    }

    // ─────────────────────────────────────────────────────────
    // GET /api/room-schedule
    // Returns all rooms with their 14 session flags.
    // Grouped by block for the UI grid.
    // ─────────────────────────────────────────────────────────
    router.get('/', async (req, res) => {
        try {
            await ensureScheduleRows();

            const [rows] = await pool.promise().query(`
                SELECT
                    rm.room_id,
                    rm.room_code  AS room_number,
                    rm.room_name,
                    rm.floor_number,
                    rm.total_capacity,
                    bm.block_id,
                    bm.block_code,
                    bm.block_name,
                    rws.schedule_id,
                    rws.mon_fn, rws.mon_an,
                    rws.tue_fn, rws.tue_an,
                    rws.wed_fn, rws.wed_an,
                    rws.thu_fn, rws.thu_an,
                    rws.fri_fn, rws.fri_an,
                    rws.sat_fn, rws.sat_an,
                    rws.sun_fn, rws.sun_an,
                    rws.updated_at
                FROM room_master rm
                LEFT JOIN block_master bm ON bm.block_id = rm.block_id
                LEFT JOIN room_weekly_schedule rws ON rws.room_id = rm.room_id
                WHERE rm.deleted_at IS NULL AND rm.is_active = 1
                ORDER BY bm.block_code, rm.floor_number, rm.room_code
            `);

            // Group by block
            const grouped = {};
            rows.forEach(r => {
                const k = r.block_code || 'Other';
                if (!grouped[k]) grouped[k] = {
                    block_code: k, block_name: r.block_name, rooms: []
                };

                // Build sessions object for easy JS access
                const sessions = {};
                ALL_COLS.forEach(col => { sessions[col] = r[col] === 1; });

                grouped[k].rooms.push({
                    room_id:        r.room_id,
                    room_number:    r.room_number,
                    room_name:      r.room_name,
                    floor_number:   r.floor_number,
                    total_capacity: r.total_capacity,
                    block_code:     r.block_code,
                    block_name:     r.block_name,
                    sessions,
                    updated_at:     r.updated_at
                });
            });

            res.json({
                columns:  ALL_COLS,
                labels:   COL_LABELS,
                grouped:  Object.values(grouped),
                rooms:    rows.length
            });

        } catch (err) {
            console.error('GET /room-schedule error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ─────────────────────────────────────────────────────────
    // POST /api/room-schedule/toggle
    // Body: { room_id, col }  e.g. { room_id: 10, col: "mon_fn" }
    // Flips 0→1 or 1→0. Returns new value.
    // ─────────────────────────────────────────────────────────
    router.post('/toggle', async (req, res) => {
        try {
            const { room_id, col } = req.body;
            if (!room_id || !col) return res.status(400).json({ error: 'room_id and col required' });
            if (!ALL_COLS.includes(col)) return res.status(400).json({ error: `Invalid column: ${col}` });

            await ensureScheduleRows();

            // Toggle: 0→1 or 1→0
            await pool.promise().query(
                `UPDATE room_weekly_schedule SET \`${col}\` = 1 - \`${col}\` WHERE room_id = ?`,
                [room_id]
            );

            // Return new value
            const [[row]] = await pool.promise().query(
                `SELECT \`${col}\` AS val FROM room_weekly_schedule WHERE room_id = ?`,
                [room_id]
            );

            res.json({ success: true, room_id, col, blocked: row?.val === 1 });

        } catch (err) {
            console.error('POST /room-schedule/toggle error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ─────────────────────────────────────────────────────────
    // POST /api/room-schedule/reset/:roomId
    // Sets all 14 sessions to FREE (0) for one room.
    // ─────────────────────────────────────────────────────────
    router.post('/reset/:roomId', async (req, res) => {
        try {
            await pool.promise().query(
                `UPDATE room_weekly_schedule SET
                    mon_fn=0,mon_an=0,tue_fn=0,tue_an=0,
                    wed_fn=0,wed_an=0,thu_fn=0,thu_an=0,
                    fri_fn=0,fri_an=0,sat_fn=0,sat_an=0,
                    sun_fn=0,sun_an=0
                WHERE room_id=?`,
                [req.params.roomId]
            );
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });


    router.post('/block-all/:roomId', async (req, res) => {
    try {
        await pool.promise().query(
            `UPDATE room_weekly_schedule SET
                mon_fn=1,mon_an=1,tue_fn=1,tue_an=1,
                wed_fn=1,wed_an=1,thu_fn=1,thu_an=1,
                fri_fn=1,fri_an=1,sat_fn=1,sat_an=1,
                sun_fn=1,sun_an=1
            WHERE room_id=?`,
            [req.params.roomId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
    // ─────────────────────────────────────────────────────────
    // GET /api/room-schedule/blocked-sessions?date=YYYY-MM-DD&session=1
    // Used by seating-allocation-routes room-availability endpoint.
    // Returns room_ids that are weekly-blocked for that day+session.
    // ─────────────────────────────────────────────────────────
    router.get('/blocked-sessions', async (req, res) => {
        try {
            const { date, session } = req.query;
            if (!date || !session) return res.status(400).json({ error: 'date and session required' });

            const col = dateToCol(date, session);
            if (!col) return res.status(400).json({ error: 'Could not resolve day column' });

            const [rows] = await pool.promise().query(
                `SELECT room_id FROM room_weekly_schedule WHERE \`${col}\` = 1`,
            );

            res.json({
                date, session, day_col: col,
                blocked_room_ids: rows.map(r => r.room_id)
            });

        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}



// Export helper so seating-allocation-routes can use it directly
module.exports = { initializeRouter, dateToCol, ALL_COLS };
