"use strict";

/** Database setup for festy. */

const { Client } = require("pg");
require('dotenv').config();
const f2 = require('fs');

const sslConfig = {
  rejectUnauthorized: true, // This should be true to verify the server's certificate against the CA
  ca: fs.readFileSync('./us-west-1-bundle.pem').toString(), // Adjust the path as necessary
};

// Create a new client instance without specifying connection details.
// The pg library will automatically use environment variables
// such as PGUSER, PGPASSWORD, PGHOST, PGPORT, and PGDATABASE.
const db = new Client(
  {
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    ssl: sslConfig,
  }
);

db.connect((err) => {
  if (err) {
    console.error('Database connection failed: ' + err.stack);
    return;
  }
  console.log('Connected to database.');
});

module.exports = db;
