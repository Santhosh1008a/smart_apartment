require('dotenv').config();

const getConnection = (isProduction) => {
  if (!process.env.DATABASE_URL) return undefined;

  const connectionUrl = new URL(process.env.DATABASE_URL);
  for (const option of ['sslcert', 'sslkey', 'sslrootcert']) {
    if (connectionUrl.searchParams.has(option)) {
      throw new Error(`Remove ${option} from DATABASE_URL and configure database TLS separately.`);
    }
  }
  // node-postgres replaces the explicit SSL options when these parameters are
  // present in the URL, so configure TLS here after removing sslmode.
  connectionUrl.searchParams.delete('sslmode');

  const sslDisabled = process.env.DATABASE_SSL === 'false';
  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';
  if (isProduction && (sslDisabled || !rejectUnauthorized)) {
    throw new Error('Production database TLS and certificate validation must remain enabled.');
  }

  return {
    connectionString: connectionUrl.toString(),
    ssl: sslDisabled ? false : { rejectUnauthorized },
  };
};

module.exports = {
  development: {
    client: 'pg',
    connection: getConnection(false),
    migrations: {
      directory: './src/db/migrations'
    },
    seeds: {
      directory: './src/db/seeds'
    }
  },
  production: {
    client: 'pg',
    connection: getConnection(true),
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './src/db/migrations'
    },
    seeds: {
      directory: './src/db/seeds'
    }
  }
};
