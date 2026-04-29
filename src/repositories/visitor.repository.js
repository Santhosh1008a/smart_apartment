const { query, getClient } = require('../config/db');

class VisitorRepository {
  async createPass(client, host_id, visitor_name, visitor_phone, purpose, valid_from, valid_until) {
    const res = await client.query(
      `INSERT INTO visitor_passes (host_user_id, visitor_name, visitor_phone, purpose, valid_from, valid_until, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING id`,
      [host_id, visitor_name, visitor_phone, purpose, valid_from, valid_until]
    );
    return res.rows[0];
  }

  async createQRCode(client, pass_id, token, expires_at) {
    const res = await client.query(
      `INSERT INTO qr_codes (visitor_pass_id, token, expires_at)
       VALUES ($1, $2, $3) RETURNING token, expires_at`,
      [pass_id, token, expires_at]
    );
    return res.rows[0];
  }

  async findQRByToken(token) {
    const res = await query('SELECT * FROM qr_codes WHERE token = $1', [token]);
    return res.rows[0];
  }

  async findPassById(pass_id) {
    const res = await query('SELECT * FROM visitor_passes WHERE id = $1', [pass_id]);
    return res.rows[0];
  }

  async checkInVisitor(client, pass_id) {
    await client.query(
      `UPDATE visitor_passes SET status = 'checked_in', checked_in_at = now() WHERE id = $1`,
      [pass_id]
    );
  }

  async incrementQRScan(client, qr_id) {
    await client.query(
      `UPDATE qr_codes SET scanned_count = scanned_count + 1 WHERE id = $1`,
      [qr_id]
    );
  }

  async findPassesByHost(host_id) {
    const res = await query(
      `SELECT * FROM visitor_passes WHERE host_user_id = $1 ORDER BY created_at DESC`,
      [host_id]
    );
    return res.rows;
  }

  async checkoutPass(pass_id, host_id) {
    const res = await query(
      `UPDATE visitor_passes SET status = 'completed', checked_out_at = now() 
       WHERE id = $1 AND host_user_id = $2 AND status = 'checked_in' RETURNING *`,
      [pass_id, host_id]
    );
    return res.rows[0];
  }

  async cancelPass(pass_id, host_id) {
    const res = await query(
      `UPDATE visitor_passes SET status = 'cancelled' 
       WHERE id = $1 AND host_user_id = $2 AND status = 'pending' RETURNING *`,
      [pass_id, host_id]
    );
    return res.rows[0];
  }
}

module.exports = new VisitorRepository();
