const bcrypt = require('bcrypt');

exports.seed = async function(knex) {
  // Clear any existing admin seed to prevent duplicates
  await knex('users').where({ email: 'admin@tdpcl.com' }).del();
  
  // Create secure hash for default password
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash('Admin@123!Secure', salt);
  
  // Seed the master admin
  await knex('users').insert([
    {
      id: '00000000-0000-0000-0000-000000000000', // Root zero UUID
      email: 'admin@tdpcl.com',
      full_name: 'Master System Admin',
      phone: '+10000000000',
      password_hash: password_hash,
      role: 'super_admin',
      is_active: true
    }
  ]);
};
