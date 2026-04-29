const { query } = require('./src/config/db');

async function seedInfra() {
  try {
    console.log('Seeding complex, building, units...');
    
    // 1. Complex
    let complexId;
    const compRes = await query('SELECT id FROM complexes LIMIT 1');
    if (compRes.rows.length === 0) {
      const { rows } = await query(`INSERT INTO complexes (name, address) VALUES ('Smart Residency', '123 Smart Way') RETURNING id`);
      complexId = rows[0].id;
      console.log('Created complex:', complexId);
    } else {
      complexId = compRes.rows[0].id;
    }

    // 2. Building
    let buildingId;
    const bldgRes = await query('SELECT id FROM buildings WHERE complex_id = $1 LIMIT 1', [complexId]);
    if (bldgRes.rows.length === 0) {
      const { rows } = await query(`INSERT INTO buildings (complex_id, name, total_floors) VALUES ($1, 'Tower A', 10) RETURNING id`, [complexId]);
      buildingId = rows[0].id;
      console.log('Created building:', buildingId);
    } else {
      buildingId = bldgRes.rows[0].id;
    }

    // 3. Units
    const units = ['101', '102'];
    const unitIds = [];
    for (const unitNumber of units) {
      const unitRes = await query('SELECT id FROM units WHERE building_id = $1 AND unit_number = $2', [buildingId, unitNumber]);
      if (unitRes.rows.length === 0) {
        const { rows } = await query(
          `INSERT INTO units (building_id, unit_number, floor, status) VALUES ($1, $2, 1, 'occupied') RETURNING id`,
          [buildingId, unitNumber]
        );
        unitIds.push(rows[0].id);
        console.log('Created unit:', unitNumber);
      } else {
        unitIds.push(unitRes.rows[0].id);
      }
    }

    // 4. Link to users (resident1 & resident2)
    const resUsers = await query(`SELECT id, email FROM users WHERE role = 'resident'`);
    if (resUsers.rows.length >= 2) {
      // Link resident 1 to unit 101
      const res1 = resUsers.rows[0].id;
      const unit101 = unitIds[0];
      const uu1 = await query('SELECT id FROM user_units WHERE user_id = $1 AND unit_id = $2', [res1, unit101]);
      if (uu1.rows.length === 0) {
         await query(`INSERT INTO user_units (user_id, unit_id, relation) VALUES ($1, $2, 'owner')`, [res1, unit101]);
         console.log('Linked resident', resUsers.rows[0].email, 'to unit 101');
      }

      // Link resident 2 to unit 102
      const res2 = resUsers.rows[1].id;
      const unit102 = unitIds[1];
      const uu2 = await query('SELECT id FROM user_units WHERE user_id = $1 AND unit_id = $2', [res2, unit102]);
      if (uu2.rows.length === 0) {
         await query(`INSERT INTO user_units (user_id, unit_id, relation) VALUES ($1, $2, 'tenant')`, [res2, unit102]);
         console.log('Linked resident', resUsers.rows[1].email, 'to unit 102');
      }
    }

    console.log('Infra seed complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding infra:', err);
    process.exit(1);
  }
}

seedInfra();
