require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const COMPLEX_ID = '42c1bcc6-f1ad-4361-92e0-93cac4143c3f';

async function run() {
  try {
    const res = await pool.query(
      "UPDATE users SET complex_id = $1 WHERE role != 'super_admin' AND complex_id IS NULL",
      [COMPLEX_ID]
    );
    console.log('Updated', res.rowCount, 'users to complex', COMPLEX_ID);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}

run();
