require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { query } = require('../src/config/db');
const { signAccessToken } = require('../src/utils/jwt');
const bcrypt = require('bcrypt');
const request = require('supertest');
const { app } = require('../src/app');
const crypto = require('crypto');

async function seedData() {
  console.log('Seeding test data...');
  const passHash = await bcrypt.hash('password123', 10);

  // 1. Create Complexes
  const compA = await query(`INSERT INTO complexes (name) VALUES ('Society A') RETURNING id`);
  const compB = await query(`INSERT INTO complexes (name) VALUES ('Society B') RETURNING id`);
  const cAId = compA.rows[0].id;
  const cBId = compB.rows[0].id;

  // 2. Create Buildings
  const bA = await query(`INSERT INTO buildings (complex_id, name) VALUES ($1, 'Block A') RETURNING id`, [cAId]);
  const bB = await query(`INSERT INTO buildings (complex_id, name) VALUES ($1, 'Block B') RETURNING id`, [cBId]);

  // 3. Create Units
  const uA = await query(`INSERT INTO units (building_id, unit_number, status) VALUES ($1, 'A-101', 'occupied') RETURNING id`, [bA.rows[0].id]);
  const uB = await query(`INSERT INTO units (building_id, unit_number, status) VALUES ($1, 'B-101', 'occupied') RETURNING id`, [bB.rows[0].id]);

  // 4. Create Users function
  const createUser = async (email, role, complexId) => {
    const res = await query(
      `INSERT INTO users (email, phone, password_hash, full_name, role, complex_id) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, role, complex_id`,
      [email, Math.floor(Math.random() * 9000000000) + 1000000000, passHash, email.split('@')[0], role, complexId]
    );
    const user = res.rows[0];
    const accessToken = signAccessToken(user);
    return { ...user, token: accessToken };
  };

  const suffix = crypto.randomBytes(4).toString('hex');
  const adminA = await createUser(`adminA_${suffix}@test.com`, 'admin', cAId);
  const resA = await createUser(`resA_${suffix}@test.com`, 'resident', cAId);
  const secA = await createUser(`secA_${suffix}@test.com`, 'security', cAId);
  const venA = await createUser(`venA_${suffix}@test.com`, 'vendor', cAId);

  const adminB = await createUser(`adminB_${suffix}@test.com`, 'admin', cBId);
  const resB = await createUser(`resB_${suffix}@test.com`, 'resident', cBId);
  const secB = await createUser(`secB_${suffix}@test.com`, 'security', cBId);
  const venB = await createUser(`venB_${suffix}@test.com`, 'vendor', cBId);

  // Link residents to units
  await query(`INSERT INTO user_units (user_id, unit_id, relation) VALUES ($1, $2, 'owner')`, [resA.id, uA.rows[0].id]);
  await query(`INSERT INTO user_units (user_id, unit_id, relation) VALUES ($1, $2, 'owner')`, [resB.id, uB.rows[0].id]);

  // Create Visitor Passes
  const passA = await query(`INSERT INTO visitor_passes (host_user_id, visitor_name, valid_until) VALUES ($1, 'Visitor A', now() + interval '1 day') RETURNING id`, [resA.id]);
  const passB = await query(`INSERT INTO visitor_passes (host_user_id, visitor_name, valid_until) VALUES ($1, 'Visitor B', now() + interval '1 day') RETURNING id`, [resB.id]);

  // Create Vendor Requests
  const reqA = await query(`INSERT INTO vendor_requests (user_id, unit_id, assigned_vendor_id, category, status) VALUES ($1, $2, $3, 'plumber', 'assigned') RETURNING id`, [resA.id, uA.rows[0].id, venA.id]);
  const reqB = await query(`INSERT INTO vendor_requests (user_id, unit_id, assigned_vendor_id, category, status) VALUES ($1, $2, $3, 'electrician', 'assigned') RETURNING id`, [resB.id, uB.rows[0].id, venB.id]);

  return {
    complexes: { A: cAId, B: cBId },
    units: { A: uA.rows[0].id, B: uB.rows[0].id },
    users: { adminA, resA, secA, venA, adminB, resB, secB, venB },
    passes: { A: passA.rows[0].id, B: passB.rows[0].id },
    requests: { A: reqA.rows[0].id, B: reqB.rows[0].id }
  };
}

async function runTests() {
  let db;
  try {
    db = await seedData();
    console.log('--- TEST SCENARIOS ---');

    // Helper for API requests
    const get = (url, token) => request(app).get(url).set('Authorization', `Bearer ${token}`);
    const post = (url, data, token) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(data);

    // 1. ADMIN ISOLATION
    let res = await get('/api/v1/admin/users', db.users.adminA.token);
    let usersA = res.body.data.some(u => u.complex_id === db.complexes.B);
    console.log(`[1] Admin A sees only Society A data: ${!usersA ? 'PASS' : 'FAIL'}`);

    // 2. RESIDENT CHECK
    res = await get('/api/v1/auth/me', db.users.resA.token);
    console.log(`[2] Resident A sees correct society: ${res.body.data.complex_name === 'Society A' ? 'PASS' : 'FAIL'}`);

    // 3. SECURITY CHECK
    res = await get('/api/v1/security/visitors/today', db.users.secA.token);
    let secSeesB = res.body.data.some(v => v.visitor_name === 'Visitor B');
    let secSeesA = res.body.data.some(v => v.visitor_name === 'Visitor A');
    console.log(`[3] Guard A sees only Society A visitors: ${secSeesA && !secSeesB ? 'PASS' : 'FAIL'}`);

    // 4. VENDOR CHECK
    res = await get('/api/v1/vendor/requests', db.users.venA.token);
    let venSeesB = res.body.data.some(r => r.category === 'electrician');
    let venSeesA = res.body.data.some(r => r.category === 'plumber');
    console.log(`[4] Vendor A sees only Society A requests: ${venSeesA && !venSeesB ? 'PASS' : 'FAIL'}`);

    // 5. CROSS-TENANT ACCESS
    res = await post(`/api/v1/admin/units/${db.units.B}/assign`, { user_id: db.users.resA.id, relation: 'tenant' }, db.users.adminA.token);
    console.log(`[5a] Admin A accessing Society B unit: ${res.status === 403 || res.status === 404 ? 'PASS (' + res.status + ')' : 'FAIL (' + res.status + ')'}`);

    res = await get('/api/v1/admin/users', db.users.venA.token);
    console.log(`[5b] Vendor accessing Admin route: ${res.status === 403 ? 'PASS' : 'FAIL'}`);

    res = await get('/api/v1/vendor/requests', db.users.secA.token);
    console.log(`[5c] Security accessing Vendor route: ${res.status === 403 ? 'PASS' : 'FAIL'}`);

    // 6. PAYMENT FLOW
    res = await post('/api/v1/admin/invoices', { unit_id: db.units.A, type: 'maintenance', amount: 1000, due_date: '2026-05-01' }, db.users.adminA.token);
    const invoiceId = res.body.data.id;
    console.log(`[6a] Create Invoice for Society A: ${res.status === 201 ? 'PASS' : 'FAIL'}`);

    // Admin B shouldn't be able to create invoice for Society A
    res = await post('/api/v1/admin/invoices', { unit_id: db.units.A, type: 'maintenance', amount: 1000, due_date: '2026-05-01' }, db.users.adminB.token);
    console.log(`[6b] Admin B creating invoice for Society A: ${res.status === 403 ? 'PASS' : 'FAIL'}`);

  } catch (err) {
    console.error('Test Execution Failed:', err);
  } finally {
    // Cleanup
    if (db) {
      console.log('Cleaning up test data...');
      await query(`DELETE FROM vendor_requests WHERE user_id IN ($1, $2, $3, $4, $5, $6, $7, $8)`, [
        db.users.adminA.id, db.users.resA.id, db.users.secA.id, db.users.venA.id,
        db.users.adminB.id, db.users.resB.id, db.users.secB.id, db.users.venB.id
      ]);
      await query(`DELETE FROM visitor_passes WHERE host_user_id IN ($1, $2)`, [db.users.resA.id, db.users.resB.id]);
      await query(`DELETE FROM user_units WHERE user_id IN ($1, $2)`, [db.users.resA.id, db.users.resB.id]);
      await query(`DELETE FROM invoices WHERE unit_id IN ($1, $2)`, [db.units.A, db.units.B]);
      await query(`DELETE FROM users WHERE complex_id IN ($1, $2)`, [db.complexes.A, db.complexes.B]);
      await query(`DELETE FROM units WHERE building_id IN (SELECT id FROM buildings WHERE complex_id IN ($1, $2))`, [db.complexes.A, db.complexes.B]);
      await query(`DELETE FROM buildings WHERE complex_id IN ($1, $2)`, [db.complexes.A, db.complexes.B]);
      await query(`DELETE FROM complexes WHERE id IN ($1, $2)`, [db.complexes.A, db.complexes.B]);
    }
    process.exit(0);
  }
}

runTests();
