const express = require('express');
const router = express.Router();
const { promisePool } = require('../config/database');

// Get programme by ID
router.get('/programme-master/:id', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            'SELECT programme_id, programme_name FROM programme_master WHERE programme_id = ? AND is_active = 1 AND deleted_at IS NULL',
            [req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Programme not found'
            });
        }
        
        res.json({
            status: 'success',
            data: rows[0]
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch programme',
            error: error.message
        });
    }
});

// Get batch by ID
router.get('/batch-master/:id', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            'SELECT batch_id, batch_name, start_year, end_year FROM batch_master WHERE batch_id = ? AND is_active = 1 AND deleted_at IS NULL',
            [req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Batch not found'
            });
        }
        
        res.json({
            status: 'success',
            data: rows[0]
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch batch',
            error: error.message
        });
    }
});

// Get branch by ID
router.get('/branch-master/:id', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            'SELECT branch_id, branch_code, branch_name FROM branch_master WHERE branch_id = ? AND is_active = 1 AND deleted_at IS NULL',
            [req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Branch not found'
            });
        }
        
        res.json({
            status: 'success',
            data: rows[0]
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch branch',
            error: error.message
        });
    }
});

// Get semester by ID
router.get('/semester-master/:id', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            'SELECT semester_id, semester_name FROM semester_master WHERE semester_id = ? AND is_active = 1 AND deleted_at IS NULL',
            [req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Semester not found'
            });
        }
        
        res.json({
            status: 'success',
            data: rows[0]
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch semester',
            error: error.message
        });
    }
});

// Get regulation by ID
router.get('/regulation-master/:id', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            'SELECT regulation_id, regulation_name FROM regulation_master WHERE regulation_id = ? AND is_active = 1 AND deleted_at IS NULL',
            [req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Regulation not found'
            });
        }
        
        res.json({
            status: 'success',
            data: rows[0]
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch regulation',
            error: error.message
        });
    }
});

// Get exam type by ID
router.get('/exam-types-master/:id', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            'SELECT exam_type_id, exam_type_name FROM exam_types_master WHERE exam_type_id = ? AND is_active = 1 AND deleted_at IS NULL',
            [req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Exam type not found'
            });
        }
        
        res.json({
            status: 'success',
            data: rows[0]
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch exam type',
            error: error.message
        });
    }
});

module.exports = { initializeRouter: () => router };
