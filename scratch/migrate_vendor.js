require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { query } = require('../src/config/db');

async function run() {
  try {
    await query(`ALTER TABLE vendor_requests ADD COLUMN IF NOT EXISTS assigned_vendor_id UUID REFERENCES users(id) ON DELETE SET NULL`);
    console.log('Added assigned_vendor_id column');
    await query(`CREATE INDEX IF NOT EXISTS idx_vendor_requests_assigned_vendor ON vendor_requests(assigned_vendor_id)`);
    console.log('Created index');
    console.log('Migration complete');
    process.exit(0);
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  }
}

run();
