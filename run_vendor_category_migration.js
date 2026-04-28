require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log('Running vendor_category migration...');
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS vendor_category VARCHAR(50);
    `);
    console.log('vendor_category column added (or already exists).');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    pool.end();
  }
}

run();
