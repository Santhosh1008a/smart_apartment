const crypto = require('crypto');
const visitorRepo = require('../repositories/visitor.repository');
const { getClient, query } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');
const { notifyMany } = require('./notification.service');

const generateToken = () => crypto.randomBytes(32).toString('hex');

class VisitorService {
  async createVisitorPass(data, host_id, io) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const pass = await visitorRepo.createPass(
        client,
        host_id,
        data.visitor_name,
        data.visitor_phone,
        data.purpose,
        data.valid_from,
        data.valid_until
      );

      const token = generateToken();
      const qrCode = await visitorRepo.createQRCode(client, pass.id, token, data.valid_until);

      await client.query('COMMIT');

      // Notify all security guards in the host's complex (fire-and-forget)
      this._notifySecurityGuards(io, host_id, data.visitor_name, data.valid_from).catch(() => {});

      return { pass_id: pass.id, qr_token: qrCode.token, expires_at: qrCode.expires_at };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async _notifySecurityGuards(io, hostId, visitorName, validFrom) {
    try {
      // Find the host's complex
      const hostResult = await query('SELECT complex_id FROM users WHERE id = $1', [hostId]);
      if (hostResult.rows.length === 0 || !hostResult.rows[0].complex_id) return;

      const complexId = hostResult.rows[0].complex_id;

      // Find all security guards in this complex
      const guardsResult = await query(
        `SELECT id FROM users WHERE role = 'security' AND complex_id = $1 AND is_active = true`,
        [complexId]
      );

      if (guardsResult.rows.length === 0) return;

      const guardIds = guardsResult.rows.map(r => r.id);
      const visitDate = new Date(validFrom).toLocaleDateString();

      await notifyMany(io, guardIds, 'new_visitor',
        'New Visitor Expected',
        `${visitorName} is expected on ${visitDate}. Please verify at entry.`,
        { visitor_name: visitorName, valid_from: validFrom }
      );
    } catch (err) {
      // Silent fail — notifications should never crash the main flow
    }
  }

  async verifyVisitorQR(token, userRole) {
    if (!token) throw new AppError('QR Token is required', 400);
    
    if (!['security', 'admin', 'super_admin'].includes(userRole)) {
      throw new AppError('Forbidden', 403);
    }

    const qr = await visitorRepo.findQRByToken(token);
    if (!qr) throw new AppError('Invalid QR Code', 404);

    if (new Date() > new Date(qr.expires_at)) {
      throw new AppError('QR Code has expired', 400);
    }

    if (qr.scanned_count >= qr.max_scans) {
      throw new AppError('QR Code has already been used maximum times', 400);
    }

    const pass = await visitorRepo.findPassById(qr.visitor_pass_id);
    if (pass.status === 'cancelled') {
        throw new AppError('Visitor pass was cancelled', 400);
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');
        await visitorRepo.checkInVisitor(client, pass.id);
        await visitorRepo.incrementQRScan(client, qr.id);
        await client.query('COMMIT');
    } catch(err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    return { message: 'Visitor successfully checked in' };
  }

  async listPasses(host_id) {
    return await visitorRepo.findPassesByHost(host_id);
  }

  async checkout(pass_id, host_id) {
    const pass = await visitorRepo.checkoutPass(pass_id, host_id);
    if (!pass) throw new AppError('Visitor pass not found or cannot be checked out', 400);
    return pass;
  }

  async cancel(pass_id, userId, userRole, complexId) {
    const pass = await visitorRepo.cancelPass(pass_id, userId, userRole, complexId);
    if (!pass) throw new AppError('Visitor pass not found or cannot be cancelled', 400);
    return pass;
  }
}

module.exports = new VisitorService();
