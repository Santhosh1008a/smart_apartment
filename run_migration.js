require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'migrations', '005_add_complex_id_to_users.sql'), 'utf8');
    console.log('Running migration...');
    await pool.query(sql);
    console.log('Migration successful.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    pool.end();
  }
}

run();
