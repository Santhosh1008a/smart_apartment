require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { getClient } = require('../src/config/db');
const bcrypt = require('bcrypt');

async function run() {
  console.log('Starting cleanup and seeding...');
  let client;

  try {
    client = await getClient();
    await client.query('BEGIN');

    // 1. DELETE existing data safely
    console.log('Cleaning up existing data...');
    await client.query('DELETE FROM razorpay_txns');
    await client.query('DELETE FROM payments');
    await client.query('DELETE FROM invoices');
    await client.query('DELETE FROM qr_codes');
    await client.query('DELETE FROM visitor_passes');
    await client.query('DELETE FROM vendor_requests');
    await client.query('DELETE FROM user_units');
    await client.query(`DELETE FROM users WHERE role != 'super_admin'`);
    await client.query('DELETE FROM units');
    await client.query('DELETE FROM buildings');
    
    // Note: UNIQUE constraint was already added during previous run

    
    await client.query('DELETE FROM complexes'); // Now we can safely delete all complexes

    // 2. CREATE SOCIETIES
    console.log('Creating societies...');
    const gvRes = await client.query(`INSERT INTO complexes (name, address) VALUES ('Green Valley Apartments', '123 Green Way, Eco City') RETURNING id`);
    const srRes = await client.query(`INSERT INTO complexes (name, address) VALUES ('Sunrise Residency', '456 Sunrise Blvd, Light City') RETURNING id`);
    const gvId = gvRes.rows[0].id;
    const srId = srRes.rows[0].id;

    // 3. CREATE BUILDINGS AND UNITS
    console.log('Creating buildings & units...');
    const bGV = await client.query(`INSERT INTO buildings (complex_id, name, total_floors) VALUES ($1, 'Block A', 5) RETURNING id`, [gvId]);
    const bSR = await client.query(`INSERT INTO buildings (complex_id, name, total_floors) VALUES ($1, 'Tower 1', 10) RETURNING id`, [srId]);

    const uGV = await client.query(`INSERT INTO units (building_id, unit_number, floor, type, status) VALUES ($1, 'A-101', 1, 'apartment', 'occupied') RETURNING id`, [bGV.rows[0].id]);
    const uSR = await client.query(`INSERT INTO units (building_id, unit_number, floor, type, status) VALUES ($1, '101', 1, 'apartment', 'occupied') RETURNING id`, [bSR.rows[0].id]);

    // 4. CREATE USERS
    console.log('Creating users...');
    const passHash = await bcrypt.hash('password123', 10);

    const createUser = async (name, email, role, complexId) => {
      const res = await client.query(
        `INSERT INTO users (email, phone, password_hash, full_name, role, complex_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [email, Math.floor(Math.random() * 9000000000) + 1000000000, passHash, name, role, complexId]
      );
      return res.rows[0].id;
    };

    // Green Valley
    const adminGV = await createUser('Rajesh Kumar', 'rajesh.gv@apt.com', 'admin', gvId);
    const resGV = await createUser('Rahul Sharma', 'rahul.gv@apt.com', 'resident', gvId);
    await createUser('Suresh Yadav', 'suresh.gv@apt.com', 'security', gvId);
    await createUser('Ramesh Plumber', 'ramesh.gv@apt.com', 'vendor', gvId);

    // Sunrise
    const adminSR = await createUser('Priya Mehta', 'priya.sr@apt.com', 'admin', srId);
    const resSR = await createUser('Amit Verma', 'amit.sr@apt.com', 'resident', srId);
    await createUser('Mahesh Singh', 'mahesh.sr@apt.com', 'security', srId);
    await createUser('Kiran Electrician', 'kiran.sr@apt.com', 'vendor', srId);

    // 5. MAP USERS TO UNITS
    console.log('Assigning residents to units...');
    await client.query(`INSERT INTO user_units (user_id, unit_id, relation) VALUES ($1, $2, 'owner')`, [resGV, uGV.rows[0].id]);
    await client.query(`INSERT INTO user_units (user_id, unit_id, relation) VALUES ($1, $2, 'owner')`, [resSR, uSR.rows[0].id]);

    await client.query('COMMIT');
    console.log('✅ Seeding completed successfully!');
    
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    if (client) await client.query('ROLLBACK');
  } finally {
    if (client) client.release();
    process.exit(0);
  }
}

run();
