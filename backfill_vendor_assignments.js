require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    // Get all pending unassigned requests
    const { rows: pending } = await p.query(`
      SELECT vr.id, vr.category, vr.status, b.complex_id 
      FROM vendor_requests vr 
      JOIN units u ON vr.unit_id = u.id 
      JOIN buildings b ON u.building_id = b.id 
      WHERE vr.assigned_vendor_id IS NULL
    `);
    console.log('Pending unassigned requests:', pending.length);

    for (const row of pending) {
      const v = await p.query(
        `SELECT id, full_name FROM users 
         WHERE role = $1 AND complex_id = $2 AND vendor_category = $3 AND is_active = true 
         LIMIT 1`,
        ['vendor', row.complex_id, row.category]
      );
      if (v.rows.length) {
        await p.query(
          `UPDATE vendor_requests SET assigned_vendor_id = $1, status = 'assigned' WHERE id = $2`,
          [v.rows[0].id, row.id]
        );
        console.log(`✓ Assigned request ${row.id} (${row.category}) → ${v.rows[0].full_name}`);
      } else {
        console.log(`✗ No matching vendor for ${row.category} in complex ${row.complex_id}`);
      }
    }

    // Show final state
    const { rows: all } = await p.query(`
      SELECT vr.id, vr.category, vr.status, u.full_name as vendor
      FROM vendor_requests vr
      LEFT JOIN users u ON vr.assigned_vendor_id = u.id
      ORDER BY vr.created_at
    `);
    console.log('\nAll vendor requests:');
    all.forEach(r => console.log(` - ${r.category} | ${r.status} | assigned to: ${r.vendor || 'nobody'}`));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    p.end();
  }
}

run();
