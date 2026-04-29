const bcrypt = require('bcrypt');
const { query } = require('./src/config/db');

const testUsers = [
  { full_name: 'System Admin', email: 'admin@example.com', phone: '9876500001', role: 'admin' },
  { full_name: 'Test Resident One', email: 'resident1@example.com', phone: '9876500002', role: 'resident' },
  { full_name: 'Test Resident Two', email: 'resident2@example.com', phone: '9876500003', role: 'resident' },
  { full_name: 'Security Guard', email: 'security@example.com', phone: '9876500004', role: 'security' },
  { full_name: 'Vendor User', email: 'vendor@example.com', phone: '9876500005', role: 'vendor' },
];

async function seedTestUsers() {
  try {
    const password_hash = await bcrypt.hash('password123', 10);
    
    console.log('Inserting test users...');
    for (const user of testUsers) {
      // Check if user already exists
      const { rows } = await query('SELECT id FROM users WHERE email = $1', [user.email]);
      if (rows.length === 0) {
        await query(
          `INSERT INTO users (email, phone, password_hash, full_name, role) VALUES ($1, $2, $3, $4, $5)`,
          [user.email, user.phone, password_hash, user.full_name, user.role]
        );
        console.log(`Created ${user.role}: ${user.email}`);
      } else {
        console.log(`User already exists: ${user.email}`);
      }
    }
    console.log('Seed complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding test users:', error);
    process.exit(1);
  }
}

seedTestUsers();
