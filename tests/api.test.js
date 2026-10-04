const request = require('supertest');
const { app } = require('../src/app');
const { query, getClient } = require('../src/config/db');
const crypto = require('crypto');
const logger = require('../src/utils/logger');

// Mock DB
jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

describe('SyncLiving API Tests', () => {
  beforeEach(() => {
    query.mockReset();
    getClient.mockReset();
  });

  describe('Auth Module', () => {
    it('returns a safe login error while recording TLS diagnostics server-side', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const loggerSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
      query.mockRejectedValueOnce(Object.assign(
        new Error('self-signed certificate in certificate chain'),
        { code: 'SELF_SIGNED_CERT_IN_CHAIN' }
      ));

      try {
        const res = await request(app).post('/api/v1/auth/login').send({
          email: 'admin@example.com',
          password: 'never-log-this-password',
        });

        expect(res.status).toBe(500);
        expect(res.body.message).toBe('Sign in is temporarily unavailable. Please try again shortly.');
        expect(res.body.stack).toBeUndefined();
        expect(res.body.error).toBeUndefined();
        expect(JSON.stringify(res.body)).not.toContain('self-signed certificate');
        expect(loggerSpy).toHaveBeenCalledWith('Unhandled API error', expect.objectContaining({
          errorCode: 'SELF_SIGNED_CERT_IN_CHAIN',
          tlsErrorCode: 'SELF_SIGNED_CERT_IN_CHAIN',
          tlsErrorMessage: 'self-signed certificate in certificate chain',
          path: '/api/v1/auth/login',
        }));
        expect(JSON.stringify(loggerSpy.mock.calls)).not.toContain('never-log-this-password');
      } finally {
        loggerSpy.mockRestore();
        if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('should block registration without required fields (Joi Validation)', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'test@example.com',
        // missing password, full_name, phone, complex_id
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors[0].message).toContain('required');
    });

    it('should require explicit acceptance of the current legal notices', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'new-resident@example.com',
        phone: '9876543210',
        password: 'long-enough-test-password',
        full_name: 'New Resident',
        complex_id: '0e88eb04-1eef-4bce-91f9-37c898018f3a',
        terms_accepted: false,
        privacy_acknowledged: true,
      });
      expect(res.status).toBe(400);
      expect(res.body.errors.map((item) => item.field)).toContain('terms_accepted');
      expect(getClient).not.toHaveBeenCalled();
    });

    it('should save a new resident and notice acknowledgements in one transaction', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 'ac91eccb-6ad0-4ed3-8485-af2fc6711011', email: 'new-resident@example.com', role: 'resident' }] })
          .mockResolvedValueOnce({ rows: [] }) // acknowledgements
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn(),
      };
      getClient.mockResolvedValueOnce(mockClient);

      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'new-resident@example.com',
        phone: '9876543210',
        password: 'long-enough-test-password',
        full_name: 'New Resident',
        complex_id: '0e88eb04-1eef-4bce-91f9-37c898018f3a',
        terms_accepted: true,
        privacy_acknowledged: true,
      });

      expect(res.status).toBe(201);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('user_notice_acknowledgements'), [
        'ac91eccb-6ad0-4ed3-8485-af2fc6711011', 'draft-2026-10-04', 'draft-2026-10-04',
      ]);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('Refresh sessions', () => {
    it('should rotate a valid refresh cookie and persist only its hash', async () => {
      const userId = '74d2d29c-4740-4c45-a20a-61b3ce529548';
      const sessionId = '8e056b3e-a0af-417a-a5cb-6c4739095ed5';
      process.env.JWT_ACCESS_SECRET = 'test_access_secret';
      process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
      const { signRefreshToken } = require('../src/utils/jwt');
      const crypto = require('crypto');
      const token = signRefreshToken({ id: userId }, sessionId);
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: sessionId }] })
          .mockResolvedValueOnce({ rows: [{ id: userId, role: 'resident', is_active: true, complex_id: null, email: 'resident@example.test', full_name: 'Resident' }] })
          .mockResolvedValueOnce({ rows: [] }) // revoke previous session
          .mockResolvedValueOnce({ rows: [] }) // insert rotated session
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn(),
      };
      getClient.mockResolvedValueOnce(mockClient);

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeTruthy();
      expect(res.headers['set-cookie'][0]).toContain('HttpOnly');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('token_hash = $3'),
        [sessionId, userId, crypto.createHash('sha256').update(token).digest('hex')]
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth_refresh_sessions'),
        expect.arrayContaining([expect.any(String), userId, expect.any(String), expect.any(Number)])
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should reject a replayed or unknown refresh cookie', async () => {
      process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
      const { signRefreshToken } = require('../src/utils/jwt');
      const token = signRefreshToken({ id: '74d2d29c-4740-4c45-a20a-61b3ce529548' }, '8e056b3e-a0af-417a-a5cb-6c4739095ed5');
      const mockClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] }),
        release: jest.fn(),
      };
      getClient.mockResolvedValueOnce(mockClient);

      const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', `refreshToken=${token}`).send({});

      expect(res.status).toBe(401);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(res.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('Role Access', () => {
    it('should return 401 when accessing protected route without token', async () => {
      const res = await request(app).get('/api/v1/admin/dashboard/stats');
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Authentication required');
    });

    it('should return 401 when monetization analytics is requested without a token', async () => {
      const res = await request(app).get('/api/v1/super-admin/monetization');
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Authentication required');
    });

    it('should deny residents access to platform monetization analytics', async () => {
      const userId = '74d2d29c-4740-4c45-a20a-61b3ce529548';
      process.env.JWT_ACCESS_SECRET = 'test_access_secret';
      const { signAccessToken } = require('../src/utils/jwt');
      query.mockResolvedValueOnce({ rows: [{ id: userId, role: 'resident', is_active: true, complex_id: null }] });

      const res = await request(app)
        .get('/api/v1/super-admin/monetization')
        .set('Authorization', `Bearer ${signAccessToken({ id: userId, role: 'resident', email: 'resident@example.test' })}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Insufficient privileges');
    });

    it('should reject apartment administrators without an assigned complex', async () => {
      const userId = '74d2d29c-4740-4c45-a20a-61b3ce529548';
      process.env.JWT_ACCESS_SECRET = 'test_access_secret';
      const { signAccessToken } = require('../src/utils/jwt');
      query.mockResolvedValueOnce({ rows: [{ id: userId, role: 'admin', is_active: true, complex_id: null }] });

      const res = await request(app)
        .get('/api/v1/admin/vendors')
        .set('Authorization', `Bearer ${signAccessToken({ id: userId, role: 'admin', email: 'admin@example.com' })}`);

      expect(res.status).toBe(403);
      expect(query).toHaveBeenCalledTimes(1);
    });

    it('should deny a security user without a complex from verifying QR passes', async () => {
      const userId = '74d2d29c-4740-4c45-a20a-61b3ce529548';
      process.env.JWT_ACCESS_SECRET = 'test_access_secret';
      const { signAccessToken } = require('../src/utils/jwt');
      query.mockResolvedValueOnce({ rows: [{ id: userId, role: 'security', is_active: true, complex_id: null }] });

      const res = await request(app)
        .post('/api/v1/visitors/verify-qr')
        .set('Authorization', `Bearer ${signAccessToken({ id: userId, role: 'security', email: 'guard@example.com' })}`)
        .send({ token: 'opaque-qr-token' });

      expect(res.status).toBe(403);
      expect(getClient).not.toHaveBeenCalled();
    });

    it('should atomically check in a visitor only when the pass is pending in the guard complex', async () => {
      const userId = '74d2d29c-4740-4c45-a20a-61b3ce529548';
      const passId = '99d2d29c-4740-4c45-a20a-61b3ce529549';
      const complexId = '0e88eb04-1eef-4bce-91f9-37c898018f3a';
      process.env.JWT_ACCESS_SECRET = 'test_access_secret';
      const { signAccessToken } = require('../src/utils/jwt');
      const notifySpy = jest.spyOn(require('../src/services/notification.service'), 'notify').mockResolvedValue(null);
      query
        .mockResolvedValueOnce({ rows: [{ id: userId, role: 'security', is_active: true, complex_id: complexId }] })
        .mockResolvedValueOnce({ rows: [{ id: passId, host_user_id: '58d2d29c-4740-4c45-a20a-61b3ce529548', visitor_name: 'Guest' }] });

      const res = await request(app)
        .post(`/api/v1/security/visitor/${passId}/checkin`)
        .set('Authorization', `Bearer ${signAccessToken({ id: userId, role: 'security', email: 'guard@example.com' })}`);

      const [transitionSql, params] = query.mock.calls[1];
      expect(res.status).toBe(200);
      expect(query).toHaveBeenCalledTimes(2);
      expect(transitionSql).toContain("vp.status = 'pending'");
      expect(transitionSql).toContain('AND EXISTS');
      expect(transitionSql).toContain('b.complex_id = $2');
      expect(params).toEqual([passId, complexId]);
      expect(notifySpy).toHaveBeenCalledTimes(1);
      notifySpy.mockRestore();
    });

    it('should not check out a visitor when the tenant-scoped atomic update matches no pass', async () => {
      const userId = '74d2d29c-4740-4c45-a20a-61b3ce529548';
      const passId = '99d2d29c-4740-4c45-a20a-61b3ce529549';
      const complexId = '0e88eb04-1eef-4bce-91f9-37c898018f3a';
      process.env.JWT_ACCESS_SECRET = 'test_access_secret';
      const { signAccessToken } = require('../src/utils/jwt');
      query
        .mockResolvedValueOnce({ rows: [{ id: userId, role: 'security', is_active: true, complex_id: complexId }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post(`/api/v1/security/visitor/${passId}/checkout`)
        .set('Authorization', `Bearer ${signAccessToken({ id: userId, role: 'security', email: 'guard@example.com' })}`);

      const [transitionSql, params] = query.mock.calls[1];
      expect(res.status).toBe(404);
      expect(query).toHaveBeenCalledTimes(2);
      expect(transitionSql).toContain("vp.status = 'checked_in'");
      expect(transitionSql).toContain('AND EXISTS');
      expect(transitionSql).toContain('b.complex_id = $2');
      expect(params).toEqual([passId, complexId]);
    });

    it('should prevent security users from creating resident visitor passes', async () => {
      const userId = '74d2d29c-4740-4c45-a20a-61b3ce529548';
      process.env.JWT_ACCESS_SECRET = 'test_access_secret';
      const { signAccessToken } = require('../src/utils/jwt');
      query.mockResolvedValueOnce({ rows: [{ id: userId, role: 'security', is_active: true, complex_id: '0e88eb04-1eef-4bce-91f9-37c898018f3a' }] });

      const res = await request(app)
        .post('/api/v1/visitors')
        .set('Authorization', `Bearer ${signAccessToken({ id: userId, role: 'security', email: 'guard@example.com' })}`)
        .send({ visitor_name: 'Guest Person', valid_from: new Date().toISOString() });

      expect(res.status).toBe(403);
      expect(getClient).not.toHaveBeenCalled();
    });

    it('should require a complex before a resident creates a visitor pass', async () => {
      const userId = '74d2d29c-4740-4c45-a20a-61b3ce529548';
      process.env.JWT_ACCESS_SECRET = 'test_access_secret';
      const { signAccessToken } = require('../src/utils/jwt');
      query.mockResolvedValueOnce({ rows: [{ id: userId, role: 'resident', is_active: true, complex_id: null }] });

      const res = await request(app)
        .post('/api/v1/visitors')
        .set('Authorization', `Bearer ${signAccessToken({ id: userId, role: 'resident', email: 'resident@example.com' })}`)
        .send({ visitor_name: 'Guest Person', valid_from: new Date().toISOString() });

      expect(res.status).toBe(403);
      expect(getClient).not.toHaveBeenCalled();
    });

    it('should scope apartment-admin account updates to the assigned complex', async () => {
      const userId = '74d2d29c-4740-4c45-a20a-61b3ce529548';
      const targetUserId = '99d2d29c-4740-4c45-a20a-61b3ce529549';
      const complexId = '0e88eb04-1eef-4bce-91f9-37c898018f3a';
      process.env.JWT_ACCESS_SECRET = 'test_access_secret';
      const { signAccessToken } = require('../src/utils/jwt');
      query.mockResolvedValueOnce({ rows: [{ id: userId, role: 'admin', is_active: true, complex_id: complexId }] });
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .patch(`/api/v1/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${signAccessToken({ id: userId, role: 'admin', email: 'admin@example.com' })}`)
        .send({ is_active: false });

      expect(res.status).toBe(404);
      expect(query.mock.calls[1][0]).toContain('AND complex_id = $3');
      expect(query.mock.calls[1][1]).toEqual([false, targetUserId, complexId]);
    });

    it('should assign a vendor only within the request complex', async () => {
      const userId = '74d2d29c-4740-4c45-a20a-61b3ce529548';
      const vendorId = '99d2d29c-4740-4c45-a20a-61b3ce529549';
      const complexId = '0e88eb04-1eef-4bce-91f9-37c898018f3a';
      process.env.JWT_ACCESS_SECRET = 'test_access_secret';
      const { signAccessToken } = require('../src/utils/jwt');
      query.mockResolvedValueOnce({ rows: [{ id: userId, role: 'admin', is_active: true, complex_id: complexId }] });
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .patch('/api/v1/admin/vendor-requests/4b0da2aa-2c6d-4ae9-99b7-95e2a3c42ab4/assign')
        .set('Authorization', `Bearer ${signAccessToken({ id: userId, role: 'admin', email: 'admin@example.com' })}`)
        .send({ vendor_id: vendorId });

      expect(res.status).toBe(404);
      expect(query.mock.calls[1][0]).toContain('vendor.complex_id = b.complex_id');
      expect(query.mock.calls[1][1]).toEqual([vendorId, '4b0da2aa-2c6d-4ae9-99b7-95e2a3c42ab4', complexId]);
    });

    it('should serve monetization analytics to an active super admin', async () => {
      const userId = '74d2d29c-4740-4c45-a20a-61b3ce529548';
      process.env.JWT_ACCESS_SECRET = 'test_access_secret';
      const { signAccessToken } = require('../src/utils/jwt');
      query.mockResolvedValueOnce({ rows: [{ id: userId, role: 'super_admin', is_active: true, complex_id: null }] });
      query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .get('/api/v1/super-admin/monetization')
        .set('Authorization', `Bearer ${signAccessToken({ id: userId, role: 'super_admin', email: 'admin@example.test' })}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.metrics.total_revenue).toBe(0);
      expect(res.body.data.has_financial_records).toBe(false);
    });

    // A test for 403 would require a mocked valid token but wrong role.
    // For a minimal example, we show the 401 guard works.
  });

  describe('Privacy requests', () => {
    it('should require an authenticated user to view their requests', async () => {
      const res = await request(app).get('/api/v1/privacy/requests');
      expect(res.status).toBe(401);
      expect(query).not.toHaveBeenCalled();
    });

    it('should return privacy requests only for the authenticated account', async () => {
      const userId = '74d2d29c-4740-4c45-a20a-61b3ce529548';
      process.env.JWT_ACCESS_SECRET = 'test_access_secret';
      const { signAccessToken } = require('../src/utils/jwt');
      query.mockResolvedValueOnce({ rows: [{ id: userId, role: 'resident', is_active: true, complex_id: '0e88eb04-1eef-4bce-91f9-37c898018f3a' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 'request-1', user_id: userId, request_type: 'access', status: 'received' }] });

      const res = await request(app)
        .get('/api/v1/privacy/requests')
        .set('Authorization', `Bearer ${signAccessToken({ id: userId, role: 'resident', email: 'resident@example.test' })}`);

      expect(res.status).toBe(200);
      expect(query.mock.calls[1][1]).toEqual([userId]);
      expect(res.body.data).toHaveLength(1);
    });

    it('should deny residents access to the privacy review inbox', async () => {
      const userId = '74d2d29c-4740-4c45-a20a-61b3ce529548';
      process.env.JWT_ACCESS_SECRET = 'test_access_secret';
      const { signAccessToken } = require('../src/utils/jwt');
      query.mockResolvedValueOnce({ rows: [{ id: userId, role: 'resident', is_active: true, complex_id: null }] });

      const res = await request(app)
        .get('/api/v1/privacy/requests/admin')
        .set('Authorization', `Bearer ${signAccessToken({ id: userId, role: 'resident', email: 'resident@example.test' })}`);

      expect(res.status).toBe(403);
      expect(query).toHaveBeenCalledTimes(1);
    });
  });

  describe('Payment Webhook Idempotency', () => {
    it('should successfully process a valid webhook and ignore duplicates', async () => {
      const secret = 'test_secret';
      process.env.RAZORPAY_WEBHOOK_SECRET = secret;

      const payload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: { id: 'pay_123', order_id: 'order_123', amount: 100, currency: 'INR', status: 'captured' }
          }
        }
      };

      const bodyString = JSON.stringify(payload);
      const signature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

      // Model the locked transaction row with no prior payment reference.
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ txn_id: 'txn1', payment_id: 'pay1', rz_payment_id: null, expected_amount: 1 }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ invoice_id: 'inv1' }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] }),
        release: jest.fn()
      };
      const duplicateClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ txn_id: 'txn1', payment_id: 'pay1', rz_payment_id: 'pay_123' }] })
          .mockResolvedValueOnce({ rows: [] }),
        release: jest.fn()
      };
      require('../src/config/db').getClient
        .mockResolvedValueOnce(mockClient)
        .mockResolvedValueOnce(duplicateClient);
      query.mockResolvedValueOnce({ rows: [] }); // no user notification is needed in this test

      const res = await request(app)
        .post('/api/v1/webhooks/razorpay')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(bodyString);

      expect(res.status).toBe(200);
      expect(res.text).toBe('OK');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');

      // The second locked transaction row already has a captured payment ID.
      const resDupe = await request(app)
        .post('/api/v1/webhooks/razorpay')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(bodyString);

      expect(resDupe.status).toBe(200);
      expect(resDupe.text).toBe('Already processed');
    });
  });
});
