require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { query } = require('../src/config/db');

async function check() {
  try {
    // 1. Check all invoices
    const invoices = await query(`
      SELECT i.id, i.unit_id, i.type, i.amount, i.status, u.unit_number, b.name as building
      FROM invoices i
      JOIN units u ON i.unit_id = u.id
      JOIN buildings b ON u.building_id = b.id
      ORDER BY i.created_at DESC LIMIT 10
    `);
    console.log('\n=== ALL INVOICES ===');
    invoices.rows.forEach(r => console.log(`  ${r.building} - ${r.unit_number}: ${r.type} Rs${r.amount} [${r.status}]`));

    // 2. Check user_units mapping for Rahul
    const mappings = await query(`
      SELECT uu.*, u.full_name, u.email, un.unit_number, b.name as building
      FROM user_units uu
      JOIN users u ON uu.user_id = u.id
      JOIN units un ON uu.unit_id = un.id
      JOIN buildings b ON un.building_id = b.id
      WHERE uu.moved_out_at IS NULL
    `);
    console.log('\n=== ACTIVE USER-UNIT MAPPINGS ===');
    mappings.rows.forEach(r => console.log(`  ${r.full_name} (${r.email}) -> ${r.building} - ${r.unit_number}`));

    // 3. Check what Rahul's listMyInvoices would return
    const rahul = await query(`SELECT id FROM users WHERE email = 'rahul.gv@apt.com'`);
    if (rahul.rows.length > 0) {
      const rahulId = rahul.rows[0].id;
      const rahulInvoices = await query(`
        SELECT i.*, u.unit_number, b.name as building_name
        FROM invoices i
        JOIN units u ON i.unit_id = u.id
        JOIN buildings b ON u.building_id = b.id
        JOIN user_units uu ON uu.unit_id = u.id
        WHERE uu.user_id = $1 AND uu.moved_out_at IS NULL
        ORDER BY i.due_date DESC
      `, [rahulId]);
      console.log(`\n=== RAHUL'S INVOICES (via listMyInvoices query) ===`);
      console.log(`  Count: ${rahulInvoices.rows.length}`);
      rahulInvoices.rows.forEach(r => console.log(`  ${r.building_name} - ${r.unit_number}: ${r.type} Rs${r.amount} [${r.status}]`));
    }

    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

check();
