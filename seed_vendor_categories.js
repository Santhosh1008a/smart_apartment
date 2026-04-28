require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    // Set vendor_category for ramesh.gv@apt.com to 'plumber' (default for Green Valley vendor)
    const res = await pool.query(
      `UPDATE users SET vendor_category = 'plumber' WHERE email = $1 AND role = 'vendor' RETURNING email, vendor_category`,
      ['ramesh.gv@apt.com']
    );
    console.log('Updated vendor category:', res.rows);

    // Also set for kiran.sr@apt.com (Sunrise Residency vendor)
    const res2 = await pool.query(
      `UPDATE users SET vendor_category = 'electrician' WHERE email = $1 AND role = 'vendor' RETURNING email, vendor_category`,
      ['kiran.sr@apt.com']
    );
    console.log('Updated vendor 2:', res2.rows);

    // Show all vendors with their categories
    const all = await pool.query(`SELECT email, full_name, vendor_category FROM users WHERE role = 'vendor'`);
    console.log('All vendors:', all.rows);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    pool.end();
  }
}

run();
