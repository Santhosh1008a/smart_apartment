jest.mock('../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../src/utils/notifications', () => ({ sendEmail: jest.fn(), sendSMS: jest.fn() }));
jest.mock('../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn() }));

const { query } = require('../src/config/db');
const { ensureSocietyNoticeNotifications, isMissingSocietyNoticesTable } = require('../src/services/notification.service');

describe('society notice notification backfill', () => {
  beforeEach(() => query.mockReset().mockResolvedValue({ rows: [] }));

  it('backfills sent notices for active resident accounts with current tenant unit associations', async () => {
    const residentTenant = {
      id: '74d2d29c-4740-4c45-a20a-61b3ce529548',
      role: 'resident',
      complex_id: null,
      is_active: true,
    };

    await ensureSocietyNoticeNotifications(residentTenant);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('INSERT INTO notifications');
    expect(sql).toContain("notice_user.role = 'resident'");
    expect(sql).toContain('notice_user.is_active = true');
    expect(sql).toContain('notice_user.complex_id = n.complex_id');
    expect(sql).toContain("notice_uu.relation::text = 'tenant'");
    expect(sql).toContain('notice_uu.moved_out_at IS NULL');
    expect(sql).toContain('notice_building.complex_id = n.complex_id');
    expect(sql).toContain('ON CONFLICT');
    expect(sql).toContain('DO NOTHING');
    expect(params).toEqual([residentTenant.id, 'society_notice']);
  });

  it('backfills for tenant-role accounts only when the SQL finds their active unit association', async () => {
    await ensureSocietyNoticeNotifications({ id: 'tenant-role-id', role: 'tenant', complex_id: null });

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("notice_user.role IN ('resident', 'tenant')");
    expect(query.mock.calls[0][0]).toContain("notice_uu.relation::text = 'tenant'");
    expect(query.mock.calls[0][0]).toContain('notice_uu.moved_out_at IS NULL');
    expect(query.mock.calls[0][1]).toEqual(['tenant-role-id', 'society_notice']);
  });

  it('does nothing for a missing or unidentified user', async () => {
    await ensureSocietyNoticeNotifications(null);
    await ensureSocietyNoticeNotifications({ role: 'resident', complex_id: 'complex-id' });

    expect(query).not.toHaveBeenCalled();
  });

  it('only treats a missing public notices relation as the expected pre-migration state', () => {
    expect(isMissingSocietyNoticesTable(Object.assign(
      new Error('relation "notices" does not exist'), { code: '42P01' }
    ))).toBe(true);
    expect(isMissingSocietyNoticesTable(Object.assign(
      new Error('relation "user_units" does not exist'), { code: '42P01' }
    ))).toBe(false);
    expect(isMissingSocietyNoticesTable(Object.assign(
      new Error('permission denied for table notices'), { code: '42501' }
    ))).toBe(false);
  });
});
