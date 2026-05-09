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

  async findPassByIdForComplex(pass_id, complexId) {
    const res = await query(
      `SELECT vp.*
       FROM visitor_passes vp
       JOIN users u ON vp.host_user_id = u.id
       JOIN user_units uu ON uu.user_id = u.id AND uu.moved_out_at IS NULL
       JOIN units un ON uu.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       WHERE vp.id = $1
         AND (b.complex_id = $2 OR $2 IS NULL)
       LIMIT 1`,
      [pass_id, complexId]
    );
    return res.rows[0];
  }

  async checkInVisitor(client, pass_id, complexId) {
    const res = await client.query(
      `UPDATE visitor_passes vp
       SET status = 'checked_in', checked_in_at = now()
       WHERE vp.id = $1
         AND vp.status = 'pending'
         AND (
           $2 IS NULL
           OR EXISTS (
             SELECT 1
             FROM users u
             JOIN user_units uu ON uu.user_id = u.id AND uu.moved_out_at IS NULL
             JOIN units un ON uu.unit_id = un.id
             JOIN buildings b ON un.building_id = b.id
             WHERE u.id = vp.host_user_id AND b.complex_id = $2
           )
         )
       RETURNING vp.id`,
      [pass_id, complexId]
    );
    return res.rows[0];
  }

  async incrementQRScan(client, qr_id) {
    await client.query(
      `UPDATE qr_codes SET scanned_count = scanned_count + 1 WHERE id = $1`,
      [qr_id]
    );
  }

  async findPassesByHost(host_id) {
    const res = await query(
      `SELECT vp.*, qr.token AS qr_token
       FROM visitor_passes vp
       LEFT JOIN qr_codes qr ON qr.visitor_pass_id = vp.id
       WHERE vp.host_user_id = $1 ORDER BY vp.created_at DESC`,
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

  async cancelPass(pass_id, userId, userRole, complexId) {
    const res = await query(
      `UPDATE visitor_passes vp
       SET status = 'cancelled'
       FROM users u
       WHERE vp.id = $1
         AND u.id = vp.host_user_id
         AND (
           vp.host_user_id = $2
           OR $3 IN ('admin', 'super_admin')
         )
         AND (u.complex_id = $4 OR $4 IS NULL)
         AND vp.status NOT IN ('cancelled', 'completed')
       RETURNING vp.*`,
      [pass_id, userId, userRole, complexId]
    );
    return res.rows[0];
  }
}

module.exports = new VisitorRepository();
