const { getDatabaseSslOptions, loadDatabaseCa } = require('../src/config/db');
const { assertProductionEnvironment } = require('../src/config/environment');
const path = require('path');

const projectCa = '-----BEGIN CERTIFICATE-----\nZmFrZS1jYS1mb3ItdGVzdHM=\n-----END CERTIFICATE-----';

const productionEnv = (overrides = {}) => ({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://test-user:test-password@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  DATABASE_SSL_CA: projectCa,
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  JWT_REFRESH_SECRET: 'b'.repeat(40),
  SUPABASE_URL: 'https://test-project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only-service-key',
  CORS_ORIGINS: 'https://app.example.test',
  ...overrides,
});

describe('database TLS configuration', () => {
  it('uses the configured CA and always verifies the database certificate', () => {
    expect(getDatabaseSslOptions({ DATABASE_SSL_CA: projectCa })).toEqual({
      ca: projectCa,
      rejectUnauthorized: true,
    });
  });

  it('loads a relative CA file from the project root', () => {
    const readFile = jest.fn(() => projectCa);
    expect(loadDatabaseCa('certs/prod-ca-2021.crt', readFile)).toBe(projectCa);
    expect(readFile).toHaveBeenCalledWith(
      path.resolve(__dirname, '..', 'certs', 'prod-ca-2021.crt'),
      'utf8',
    );
  });

  it('rejects certificate paths outside the project root', () => {
    expect(() => loadDatabaseCa('../outside.crt', jest.fn()))
      .toThrow('DATABASE_SSL_CA certificate path must stay inside the project root');
  });

  it('rejects plaintext database connections and disabled certificate validation', () => {
    expect(() => getDatabaseSslOptions({ DATABASE_SSL: 'false' }))
      .toThrow('Database TLS must remain enabled');
    expect(() => getDatabaseSslOptions({ DATABASE_SSL_REJECT_UNAUTHORIZED: 'false' }))
      .toThrow('Database certificate validation must remain enabled');
  });

  it('rejects malformed CA configuration', () => {
    expect(() => getDatabaseSslOptions({ DATABASE_SSL_CA: 'package.json' }))
      .toThrow('DATABASE_SSL_CA must point to a PEM-encoded CA certificate');
  });

  it('requires the project CA for a production Supabase pooler connection', () => {
    expect(() => assertProductionEnvironment(productionEnv({ DATABASE_SSL_CA: '' })))
      .toThrow('DATABASE_SSL_CA must point to or contain the project CA certificate');
    expect(() => assertProductionEnvironment(productionEnv())).not.toThrow();
  });
});
