const request = require('supertest');
const { app } = require('../src/app');
const { query } = require('../src/config/db');
const crypto = require('crypto');

// Mock DB
jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

describe('Smart Apartment API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Auth Module', () => {
    it('should block registration without required fields (Joi Validation)', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'test@example.com',
        // missing password, full_name, phone, complex_id
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors[0].message).toContain('required');
    });
  });

  describe('Role Access', () => {
    it('should return 401 when accessing protected route without token', async () => {
      const res = await request(app).get('/api/v1/admin/dashboard/stats');
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Authentication required');
    });

    // A test for 403 would require a mocked valid token but wrong role.
    // For a minimal example, we show the 401 guard works.
  });

  describe('Payment Webhook Idempotency', () => {
    it('should successfully process a valid webhook and ignore duplicates', async () => {
      const secret = 'test_secret';
      process.env.RAZORPAY_WEBHOOK_SECRET = secret;

      const payload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: { id: 'pay_123', order_id: 'order_123' }
          }
        }
      };

      const bodyString = JSON.stringify(payload);
      const signature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

      // First call: simulate not processed yet
      query.mockResolvedValueOnce({ rows: [] }); // dupe check
      query.mockResolvedValueOnce({ rows: [{ txn_id: 'txn1', payment_id: 'pay1' }] }); // order check
      
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ invoice_id: 'inv1' }] }),
        release: jest.fn()
      };
      require('../src/config/db').getClient.mockResolvedValueOnce(mockClient);

      const res = await request(app)
        .post('/api/v1/webhooks/razorpay')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(bodyString);

      expect(res.status).toBe(200);
      expect(res.text).toBe('OK');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');

      // Second call: simulate already processed
      query.mockResolvedValueOnce({ rows: [{ id: 'txn1' }] }); // dupe check returns existing row
      
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
