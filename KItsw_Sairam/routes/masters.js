// Masters API Routes
// Provides endpoints for all master data used in internal exam notifications

const express = require('express');
const mysql = require('mysql2/promise');

function initializeRouter(promisePool) {
    const router = express.Router();
    
    // Get all programmes
    router.get('/programmes', async (req, res) => {
        try {
            console.log('Fetching programmes...');
            const [programmes] = await promisePool.execute(
                'SELECT programme_id, programme_name, programme_code FROM programme_master WHERE is_active = 1 ORDER BY programme_name'
            );
            console.log('Programmes found:', programmes.length);
            
            res.status(200).json({
                status: 'success',
                data: programmes
            });
        } catch (error) {
            console.error('Error fetching programmes:', error);
            res.status(500).json({
                status: 'error',
                message: 'Error fetching programmes',
                error: error.message
            });
        }
    });
    
    // Get all batches
    router.get('/batches', async (req, res) => {
        try {
            console.log('Fetching batches...');
            const [batches] = await promisePool.execute(
                'SELECT batch_id, batch_name, start_year FROM batch_master WHERE is_active = 1 ORDER BY start_year'
            );
            console.log('Batches found:', batches.length);
            
            res.status(200).json({
                status: 'success',
                data: batches
            });
        } catch (error) {
            console.error('Error fetching batches:', error);
            console.error('SQL Error Details:', error.sqlMessage);
            res.status(500).json({
                status: 'error',
                message: 'Error fetching batches',
                error: error.message
            });
        }
    });
    
    // Get all semesters
    router.get('/semesters', async (req, res) => {
        try {
            console.log('Fetching semesters...');
            const [semesters] = await promisePool.execute(
                'SELECT semester_id, semester_name, semester_number as semester_code FROM semester_master WHERE is_active = 1 ORDER BY semester_number'
            );
            console.log('Semesters found:', semesters.length);
            
            res.status(200).json({
                status: 'success',
                data: semesters
            });
        } catch (error) {
            console.error('Error fetching semesters:', error);
            res.status(500).json({
                status: 'error',
                message: 'Error fetching semesters',
                error: error.message
            });
        }
    });
    
    // Get all regulations
    router.get('/regulations', async (req, res) => {
        try {
            console.log('Fetching regulations...');
            const [regulations] = await promisePool.execute(
                'SELECT regulation_id, regulation_name, regulation_year FROM regulation_master WHERE is_active = 1 ORDER BY regulation_name'
            );
            console.log('Regulations found:', regulations.length);
            
            res.status(200).json({
                status: 'success',
                data: regulations
            });
        } catch (error) {
            console.error('Error fetching regulations:', error);
            console.error('SQL Error Details:', error.sqlMessage);
            res.status(500).json({
                status: 'error',
                message: 'Error fetching regulations',
                error: error.message
            });
        }
    });
    
    // Get exam types
    router.get('/exam-types', async (req, res) => {
        try {
            console.log('Fetching exam types...');
            const [examTypes] = await promisePool.execute(
                'SELECT exam_type_id, exam_type_name, exam_type_code FROM exam_types_master WHERE is_active = 1 ORDER BY exam_type_name'
            );
            console.log('Exam types found:', examTypes.length);
            
            res.status(200).json({
                status: 'success',
                data: examTypes
            });
        } catch (error) {
            console.error('Error fetching exam types:', error);
            res.status(500).json({
                status: 'error',
                message: 'Error fetching exam types',
                error: error.message
            });
        }
    });
    
    // Get sessions
    router.get('/sessions', async (req, res) => {
        try {
            console.log('Fetching sessions...');
            const [sessions] = await promisePool.execute(
                'SELECT session_id, session_name, start_time, end_time FROM sessions_master WHERE is_active = 1 ORDER BY session_name'
            );
            console.log('Sessions found:', sessions.length);
            
            res.status(200).json({
                status: 'success',
                data: sessions
            });
        } catch (error) {
            console.error('Error fetching sessions:', error);
            res.status(500).json({
                status: 'error',
                message: 'Error fetching sessions',
                error: error.message
            });
        }
    });
    
    // Get month/year
    router.get('/month-year', async (req, res) => {
        try {
            console.log('Fetching month/year...');
            const [monthYears] = await promisePool.execute(
                'SELECT month_year_id, display_name, month_name, year_value FROM month_year_master WHERE is_active = 1 ORDER BY year_value DESC, month_number DESC'
            );
            console.log('Month/Year found:', monthYears.length);
            
            res.status(200).json({
                status: 'success',
                data: monthYears
            });
        } catch (error) {
            console.error('Error fetching month/year:', error);
            res.status(500).json({
                status: 'error',
                message: 'Error fetching month/year',
                error: error.message
            });
        }
    });
    
    return router;
}

module.exports = { initializeRouter };
