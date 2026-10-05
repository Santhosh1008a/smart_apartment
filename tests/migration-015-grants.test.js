const { SERVICE_ROLE_PRIVILEGES, TABLE_PRIVILEGES, validatePrivilegeSet } = require('../scratch/migration_015_privilege_validation.cjs');

function grants(...enabled) {
  return Object.fromEntries(TABLE_PRIVILEGES.map((privilege) => [privilege, enabled.includes(privilege)]));
}

describe('Migration 015 service-role grants', () => {
  it('accepts exactly the intended service_role CRUD privileges', () => {
    const report = validatePrivilegeSet(grants(...SERVICE_ROLE_PRIVILEGES), SERVICE_ROLE_PRIVILEGES);

    expect(report).toEqual({
      compatible: true,
      expected: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      actual: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      missing: [],
      unexpected: [],
    });
  });

  it('reports a missing intended privilege separately', () => {
    const report = validatePrivilegeSet(grants('SELECT', 'UPDATE', 'DELETE'), SERVICE_ROLE_PRIVILEGES);

    expect(report.compatible).toBe(false);
    expect(report.missing).toEqual(['INSERT']);
    expect(report.unexpected).toEqual([]);
  });

  it('reports unexpected default privileges, including PostgreSQL MAINTAIN', () => {
    const report = validatePrivilegeSet(
      grants(...SERVICE_ROLE_PRIVILEGES, 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'),
      SERVICE_ROLE_PRIVILEGES
    );

    expect(report.compatible).toBe(false);
    expect(report.missing).toEqual([]);
    expect(report.unexpected).toEqual(['TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']);
  });
});
