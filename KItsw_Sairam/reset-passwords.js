const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const newPassword = 'Reset@1234';
    const hash = await bcrypt.hash(newPassword, 12);

    await conn.execute(
        'UPDATE users SET password_hash = ?, login_attempts = 0, locked_until = NULL WHERE username != ?',
        [hash, 'Admin']
    );

    console.log('All non-Admin users password reset to: Reset@1234');
    await conn.end();
})();
