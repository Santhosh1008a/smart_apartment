const { query } = require('../src/config/db');

async function updateRole() {
  try {
    await query("UPDATE users SET role = 'super_admin' WHERE email = 'admin@tdpcl.com'");
    console.log('Role updated to super_admin successfully!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

updateRole();
