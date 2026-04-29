const { query } = require('./src/config/db');

async function seedVendorRequest() {
  try {
    const resUsers = await query(`SELECT id FROM users WHERE role = 'resident' LIMIT 1`);
    if (resUsers.rows.length === 0) throw new Error('No residents found');
    const userId = resUsers.rows[0].id;

    const unitRes = await query(`SELECT unit_id FROM user_units WHERE user_id = $1 LIMIT 1`, [userId]);
    if (unitRes.rows.length === 0) throw new Error('No units for resident');
    const unitId = unitRes.rows[0].unit_id;

    console.log('Inserting assigned vendor request...');
    await query(
      `INSERT INTO vendor_requests (user_id, unit_id, category, description, priority, status)
       VALUES ($1, $2, 'plumber', 'Test Leaking Pipe (Seed)', 'high', 'assigned')`,
      [userId, unitId]
    );

    console.log('Created assigned vendor request successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

seedVendorRequest();
