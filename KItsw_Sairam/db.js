const mysql = require('mysql2');

const db = mysql.createPool({
  host: 'sql10.freesqldatabase.com',
  user: 'sql10819284',
  password: 'FQi9tlzTH9',
  database: 'sql10819284',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = db.promise();