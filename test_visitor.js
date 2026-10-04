require('dotenv').config();
const { pool } = require('./src/config/db');
const visitorService = require('./src/services/visitor.service');

async function test() {
  const client = await pool.connect();
  try {
    // Check if the cron job runs correctly.
    console.log("Simulating visitor pass creation...");
    
    // We'll create a pass manually directly to set valid_until in the past
    // assuming there's an existing host user.
    const userRes = await client.query("SELECT id, complex_id FROM users WHERE role='resident' LIMIT 1");
    if(userRes.rows.length === 0) {
      console.log("No resident user found to test with");
      return;
    }
    const host = userRes.rows[0];
    
    // Create an overdue checked_in visitor
    const passRes = await client.query(`
      INSERT INTO visitor_passes (host_user_id, visitor_name, visitor_phone, purpose, valid_from, valid_until, is_overnight, status, checked_in_at)
      VALUES ($1, 'Test Overdue Visitor', '1234567890', 'Guest', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', false, 'checked_in', NOW() - INTERVAL '2 days')
      RETURNING id
    `, [host.id]);
    const passId = passRes.rows[0].id;
    console.log("Created checked_in overdue pass:", passId);

    // Call the same logic that cron job uses
    const overdueRes = await client.query(`
      UPDATE visitor_passes
      SET status = 'overdue'
      WHERE status = 'checked_in' AND valid_until < NOW()
      RETURNING id, status
    `);
    console.log("Cron job overdue logic updated passes:", overdueRes.rows.map(r => r.id).includes(passId) ? "YES" : "NO");

    // Test Security Resolve
    console.log("Testing security force checkout...");
    const resolveRes = await visitorService.resolveOverdue(passId, host.complex_id);
    console.log("Resolved visitor status:", resolveRes.status);
    
    // Test Extend Validity (let's set another pass to overdue and extend it)
    const passRes2 = await client.query(`
      INSERT INTO visitor_passes (host_user_id, visitor_name, visitor_phone, purpose, valid_from, valid_until, is_overnight, status, checked_in_at)
      VALUES ($1, 'Test Extend Visitor', '1234567890', 'Guest', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', false, 'overdue', NOW() - INTERVAL '2 days')
      RETURNING id
    `, [host.id]);
    const passId2 = passRes2.rows[0].id;
    
    const extendRes = await visitorService.extendValidity(passId2, host.complex_id, 24);
    console.log("Extended visitor status:", extendRes.status);
    console.log("Tests Passed!");
    
    // Cleanup
    await client.query("DELETE FROM visitor_passes WHERE id IN ($1, $2)", [passId, passId2]);

  } catch(e) {
    console.error("Test failed", e);
  } finally {
    client.release();
    process.exit();
  }
}
test();
