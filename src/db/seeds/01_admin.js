const bcrypt = require('bcrypt');

exports.seed = async function(knex) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The development super-admin seed cannot run in production.');
  }

  const email = process.env.SEED_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  const fullName = process.env.SEED_SUPER_ADMIN_NAME?.trim();
  if (!email || !password || !fullName) {
    throw new Error('Set SEED_SUPER_ADMIN_EMAIL, SEED_SUPER_ADMIN_PASSWORD, and SEED_SUPER_ADMIN_NAME to seed a local admin.');
  }
  if (password.length < 16) {
    throw new Error('SEED_SUPER_ADMIN_PASSWORD must be at least 16 characters.');
  }

  const existing = await knex('users').where({ email }).first('id');
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, 12);
  await knex('users').insert({
    email,
    full_name: fullName,
    password_hash: passwordHash,
    role: 'super_admin',
    is_active: true,
  });
};
