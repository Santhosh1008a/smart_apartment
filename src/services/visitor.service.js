const crypto = require('crypto');
const visitorRepo = require('../repositories/visitor.repository');
const { getClient } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');

const generateToken = () => crypto.randomBytes(32).toString('hex');

class VisitorService {
  async createVisitorPass(data, host_id) {
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
      return { pass_id: pass.id, qr_token: qrCode.token, expires_at: qrCode.expires_at };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
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

  async cancel(pass_id, host_id) {
    const pass = await visitorRepo.cancelPass(pass_id, host_id);
    if (!pass) throw new AppError('Visitor pass not found or cannot be cancelled', 400);
    return pass;
  }
}

module.exports = new VisitorService();
