const mysql = require('mysql2');

console.log('🔍 Database Config:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'EMPTY');
console.log('DB_NAME:', process.env.DB_NAME);

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Iamgod@123456',
    database: process.env.DB_NAME || 'engineering_college',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const promisePool = pool.promise();

module.exports = { pool, promisePool };
