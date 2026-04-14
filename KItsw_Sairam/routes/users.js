const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const router = express.Router();

// Initialize router with database pool
function initializeRouter(promisePool) {
    const saltRounds = 12;

    // Helper function to hash password
    async function hashPassword(password) {
        return await bcrypt.hash(password, saltRounds);
    }

    // Helper function to verify password
    async function verifyPassword(password, hash) {
        return await bcrypt.compare(password, hash);
    }

    // Helper function to generate temporary password
    function generateTempPassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    // Helper function to log user activity
    async function logUserActivity(userId, activityType, ipAddress, userAgent, details = null) {
        try {
            await promisePool.execute(
                `INSERT INTO user_activity_log (user_id, activity_type, ip_address, user_agent, activity_details) 
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, activityType, ipAddress, userAgent, details ? JSON.stringify(details) : null]
            );
        } catch (error) {
            console.error('Activity log error:', error);
        }
    }

    // Check username availability
    router.get('/check-username/:username', async (req, res) => {
        try {
            const username = req.params.username;
            
            const [users] = await promisePool.execute(
                'SELECT user_id FROM users WHERE username = ?',
                [username]
            );

            res.json({
                success: true,
                available: users.length === 0
            });
        } catch (error) {
            console.error('Check username error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to check username availability'
            });
        }
    });

    // Check email availability
    router.get('/check-email/:email', async (req, res) => {
        try {
            const email = req.params.email;
            
            const [users] = await promisePool.execute(
                'SELECT user_id FROM users WHERE email = ?',
                [email]
            );

            res.json({
                success: true,
                available: users.length === 0
            });
        } catch (error) {
            console.error('Check email error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to check email availability'
            });
        }
    });

    // Get all users with pagination and filters
    router.get('/', async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            const search = req.query.search || '';
            const role = req.query.role || '';
            const status = req.query.status || '';

            let whereConditions = [];
            let params = [];

            // Build WHERE conditions
            if (search) {
                whereConditions.push('(u.username LIKE ? OR u.email LIKE ? OR s.full_name LIKE ?)');
                params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }

            if (role) {
                whereConditions.push('u.user_role = ?');
                params.push(role);
            }

            if (status) {
                if (status === 'locked') {
                    whereConditions.push('(u.locked_until IS NOT NULL AND u.locked_until > NOW())');
                } else {
                    whereConditions.push('u.is_active = ?');
                    params.push(status === 'active' ? 1 : 0);
                }
            }

            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

            // Get total count
            const countQuery = `
                SELECT COUNT(*) as total 
                FROM users u 
                LEFT JOIN staff_master s ON u.staff_id = s.staff_id 
                ${whereClause}
            `;
            const [countResult] = await promisePool.execute(countQuery, params);
            const total = countResult[0].total;

            // Get users
            const usersQuery = `
                SELECT u.user_id, u.username, u.email, u.user_role, u.is_active, 
                       u.last_login, u.locked_until, u.staff_id
                FROM users u 
                ${whereClause}
                ORDER BY u.created_at DESC
            `;
            const [users] = await promisePool.execute(usersQuery, params);
            
            // Handle pagination in JavaScript
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedUsers = users.slice(startIndex, endIndex);

            res.json({
                success: true,
                users: paginatedUsers,
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalUsers: total
            });
        } catch (error) {
            console.error('Get users error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch users'
            });
        }
    });

    // Get single user by ID
    router.get('/:id', async (req, res) => {
        try {
            const userId = req.params.id;

            const [users] = await promisePool.execute(`
                SELECT u.user_id, u.username, u.email, u.user_role, u.is_active, 
                       u.last_login, u.staff_id, s.full_name, s.employee_id
                FROM users u 
                LEFT JOIN staff_master s ON u.staff_id = s.staff_id 
                WHERE u.user_id = ?
            `, [userId]);

            if (users.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            res.json({
                success: true,
                user: users[0]
            });
        } catch (error) {
            console.error('Get user error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch user'
            });
        }
    });

    // Create new user
    router.post('/', async (req, res) => {
        try {
            const { username, email, password, userRole, staffId } = req.body;

            // Validation
            if (!username || !email || !password || !userRole) {
                return res.status(400).json({
                    success: false,
                    message: 'All required fields must be provided'
                });
            }

            // Check if username already exists
            const [existingUsers] = await promisePool.execute(
                'SELECT user_id FROM users WHERE username = ? OR email = ?',
                [username, email]
            );

            if (existingUsers.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Username or email already exists'
                });
            }

            // Hash password
            const passwordHash = await hashPassword(password);

            // Insert user
            const [result] = await promisePool.execute(`
                INSERT INTO users (username, email, password_hash, user_role, staff_id, is_first_login, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [username, email, passwordHash, userRole, staffId || null, true, null]);

            // Log activity (if we have a logged-in user)
            // await logUserActivity(result.insertId, 'User_Created', req.ip, req.get('User-Agent'));

            res.status(201).json({
                success: true,
                message: 'User created successfully',
                userId: result.insertId
            });
        } catch (error) {
            console.error('Create user error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create user'
            });
        }
    });

    // Update user
    router.put('/:id', async (req, res) => {
        try {
            const userId = req.params.id;
            const { username, email, password, userRole, staffId } = req.body;

            // Check if user exists
            const [existingUsers] = await promisePool.execute(
                'SELECT user_id FROM users WHERE user_id = ?',
                [userId]
            );

            if (existingUsers.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Check for duplicate username/email (excluding current user)
            const [duplicateUsers] = await promisePool.execute(
                'SELECT user_id FROM users WHERE (username = ? OR email = ?) AND user_id != ?',
                [username, email, userId]
            );

            if (duplicateUsers.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Username or email already exists'
                });
            }

            // Build update query
            let updateFields = ['username = ?', 'email = ?', 'user_role = ?', 'staff_id = ?'];
            let updateParams = [username, email, userRole, staffId || null];

            // Add password if provided
            if (password) {
                updateFields.push('password_hash = ?', 'is_first_login = ?', 'last_password_change = NOW()');
                const passwordHash = await hashPassword(password);
                updateParams.push(passwordHash, false);
            }

            updateParams.push(userId);

            await promisePool.execute(
                `UPDATE users SET ${updateFields.join(', ')} WHERE user_id = ?`,
                updateParams
            );

            res.json({
                success: true,
                message: 'User updated successfully'
            });
        } catch (error) {
            console.error('Update user error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update user'
            });
        }
    });

    // Delete user
    router.delete('/:id', async (req, res) => {
        try {
            const userId = req.params.id;

            // Prevent deletion of admin user
            const [adminCheck] = await promisePool.execute(
                'SELECT user_id FROM users WHERE user_id = ? AND user_role = ?',
                [userId, 'Admin']
            );

            if (adminCheck.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete admin user'
                });
            }

            // Check if user exists
            const [existingUsers] = await promisePool.execute(
                'SELECT user_id FROM users WHERE user_id = ?',
                [userId]
            );

            if (existingUsers.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Delete user
            await promisePool.execute('DELETE FROM users WHERE user_id = ?', [userId]);

            res.json({
                success: true,
                message: 'User deleted successfully'
            });
        } catch (error) {
            console.error('Delete user error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete user'
            });
        }
    });

    // Reset user password
    router.post('/:id/reset-password', async (req, res) => {
        try {
            const userId = req.params.id;

            // Check if user exists
            const [existingUsers] = await promisePool.execute(
                'SELECT username FROM users WHERE user_id = ?',
                [userId]
            );

            if (existingUsers.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Generate temporary password
            const tempPassword = generateTempPassword();
            const passwordHash = await hashPassword(tempPassword);

            // Update password
            await promisePool.execute(
                'UPDATE users SET password_hash = ?, is_first_login = true, last_password_change = NOW() WHERE user_id = ?',
                [passwordHash, userId]
            );

            res.json({
                success: true,
                message: 'Password reset successfully',
                tempPassword: tempPassword
            });
        } catch (error) {
            console.error('Reset password error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to reset password'
            });
        }
    });

    // Toggle user status (active/inactive)
    router.patch('/:id/toggle-status', async (req, res) => {
        try {
            const userId = req.params.id;

            // Prevent deactivating admin user
            const [adminCheck] = await promisePool.execute(
                'SELECT user_id FROM users WHERE user_id = ? AND user_role = ?',
                [userId, 'Admin']
            );

            if (adminCheck.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot deactivate admin user'
                });
            }

            // Toggle status
            await promisePool.execute(
                'UPDATE users SET is_active = NOT is_active WHERE user_id = ?',
                [userId]
            );

            res.json({
                success: true,
                message: 'User status updated successfully'
            });
        } catch (error) {
            console.error('Toggle status error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update user status'
            });
        }
    });

    // Get user permissions
    router.get('/:id/permissions', async (req, res) => {
        try {
            const userId = req.params.id;

            const [user] = await promisePool.execute(
                'SELECT user_role FROM users WHERE user_id = ?',
                [userId]
            );

            if (user.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            const [permissions] = await promisePool.execute(`
                SELECT p.permission_name, p.permission_description, p.module_name
                FROM user_permissions p
                JOIN user_role_permissions urp ON p.permission_id = urp.permission_id
                WHERE urp.user_role = ?
            `, [user[0].user_role]);

            res.json({
                success: true,
                permissions: permissions
            });
        } catch (error) {
            console.error('Get permissions error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch user permissions'
            });
        }
    });

    // Get user activity log
    router.get('/:id/activity', async (req, res) => {
        try {
            const userId = req.params.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;

            const [activities] = await promisePool.execute(`
                SELECT activity_type, ip_address, user_agent, activity_details, created_at
                FROM user_activity_log
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `, [userId, limit, offset]);

            const [countResult] = await promisePool.execute(
                'SELECT COUNT(*) as total FROM user_activity_log WHERE user_id = ?',
                [userId]
            );

            res.json({
                success: true,
                activities: activities,
                currentPage: page,
                totalPages: Math.ceil(countResult[0].total / limit),
                totalActivities: countResult[0].total
            });
        } catch (error) {
            console.error('Get activity error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch user activity'
            });
        }
    });

    return router;
}

module.exports = { initializeRouter };
