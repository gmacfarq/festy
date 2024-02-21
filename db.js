"use strict";

/** Database setup for festy. */

const { Client } = require("pg");
require('dotenv').config();
//testing
// Create a new client instance without specifying connection details.
// The pg library will automatically use environment variables
// such as PGUSER, PGPASSWORD, PGHOST, PGPORT, and PGDATABASE.
const db = new Client();

db.connect();

module.exports = db;
