const assertProductionEnvironment = (env = process.env) => {
  if (env.NODE_ENV !== 'production') return;

  const missing = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    .filter((name) => !env[name]?.trim());
  const errors = [];
  if (missing.length) errors.push(`Missing required production variables: ${missing.join(', ')}`);

  for (const name of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    if (env[name] && Buffer.byteLength(env[name], 'utf8') < 32) {
      errors.push(`${name} must contain at least 32 bytes.`);
    }
  }
  if (env.JWT_ACCESS_SECRET && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.');
  }

  const origins = (env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  if (!origins.length) errors.push('CORS_ORIGINS must contain the exact HTTPS frontend origin(s).');
  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== 'https:' || parsed.origin !== origin) errors.push('CORS_ORIGINS entries must be HTTPS origins without paths.');
    } catch {
      errors.push('CORS_ORIGINS contains an invalid origin.');
    }
  }
  if (env.DATABASE_SSL === 'false' || env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false') {
    errors.push('Production database TLS and certificate validation must remain enabled.');
  }
  try {
    const databaseUrl = new URL(env.DATABASE_URL || '');
    if (['sslcert', 'sslkey', 'sslrootcert'].some((option) => databaseUrl.searchParams.has(option))) {
      errors.push('Remove SSL certificate query options from DATABASE_URL; configure TLS with the approved database certificate settings.');
    }
    if (databaseUrl.hostname.endsWith('.pooler.supabase.com') && !env.DATABASE_SSL_CA?.trim()) {
      errors.push('DATABASE_SSL_CA must point to or contain the project CA certificate from Supabase Database Settings for verified pooler connections.');
    }
  } catch {
    // DATABASE_URL absence or malformed URLs are reported by the required-variable check.
  }
  if (Boolean(env.RAZORPAY_KEY_ID) !== Boolean(env.RAZORPAY_KEY_SECRET)) {
    errors.push('Configure both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, or leave both unset.');
  }
  if (env.RAZORPAY_KEY_ID && !env.RAZORPAY_WEBHOOK_SECRET) {
    errors.push('RAZORPAY_WEBHOOK_SECRET is required when Razorpay is enabled.');
  }

  if (errors.length) throw new Error(`Production configuration is incomplete: ${errors.join(' ')}`);
};

module.exports = { assertProductionEnvironment };
