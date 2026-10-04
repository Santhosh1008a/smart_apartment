const { Pool } = require('pg');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const projectRoot = path.resolve(__dirname, '../..');

const loadDatabaseCa = (configuredCa, readFile = fs.readFileSync) => {
  const value = configuredCa?.trim();
  if (!value) return undefined;

  let ca = value;
  if (!value.startsWith('-----BEGIN CERTIFICATE-----')) {
    if (path.isAbsolute(value)) {
      throw new Error('DATABASE_SSL_CA must be a certificate path relative to the project root or PEM contents.');
    }
    const certificatePath = path.resolve(projectRoot, value);
    const relativePath = path.relative(projectRoot, certificatePath);
    if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
      throw new Error('DATABASE_SSL_CA certificate path must stay inside the project root.');
    }
    ca = readFile(certificatePath, 'utf8').trim();
  }

  if (!/-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/.test(ca)) {
    throw new Error('DATABASE_SSL_CA must point to a PEM-encoded CA certificate or contain PEM contents.');
  }
  return ca;
};

const getDatabaseSslOptions = (env = process.env) => {
  if (String(env.DATABASE_SSL || '').trim().toLowerCase() === 'false') {
    throw new Error('DATABASE_SSL=false is not supported. Database TLS must remain enabled.');
  }
  if (String(env.DATABASE_SSL_REJECT_UNAUTHORIZED || '').trim().toLowerCase() === 'false') {
    throw new Error('DATABASE_SSL_REJECT_UNAUTHORIZED=false is not supported. Database certificate validation must remain enabled.');
  }

  const ca = loadDatabaseCa(env.DATABASE_SSL_CA);

  return {
    ...(ca ? { ca } : {}),
    rejectUnauthorized: true,
  };
};

const getConnectionString = () => {
  if (!process.env.DATABASE_URL) return undefined;
  const connectionUrl = new URL(process.env.DATABASE_URL);
  for (const option of ['sslcert', 'sslkey', 'sslrootcert']) {
    if (connectionUrl.searchParams.has(option)) {
      throw new Error(`Remove ${option} from DATABASE_URL and configure database TLS separately.`);
    }
  }
  // node-postgres replaces the supplied SSL object if the URI includes
  // sslmode/sslcert/sslkey/sslrootcert; TLS is configured below instead.
  connectionUrl.searchParams.delete('sslmode');
  return connectionUrl.toString();
};

const pool = new Pool({
  connectionString: getConnectionString(),
  ssl: getDatabaseSslOptions(),
  connectionTimeoutMillis: 10000,  // fail fast after 10s instead of hanging
  idleTimeoutMillis: 30000,
  max: 10,
});

pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle database client', { errorName: err.name, errorCode: err.code });
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
  loadDatabaseCa,
  getDatabaseSslOptions,
};
