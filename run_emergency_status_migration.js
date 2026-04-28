require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log('Running emergency status migration...');
    await p.query(`
      ALTER TABLE emergency_alerts
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'resolved', 'false_alarm'));
    `);
    console.log('✓ status column added to emergency_alerts');

    // Backfill: any existing rows should be 'active'
    const res = await p.query(`UPDATE emergency_alerts SET status = 'active' WHERE status IS NULL`);
    console.log(`✓ Backfilled ${res.rowCount} rows`);

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    p.end();
  }
}

run();
