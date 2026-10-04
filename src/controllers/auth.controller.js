const bcrypt = require('bcrypt');
const Joi = require('joi');
const crypto = require('crypto');
const { query, getClient } = require('../config/db');
const supabase = require('../config/supabase');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { AppError } = require('../middlewares/error.middleware');
const logger = require('../utils/logger');
const { TERMS_NOTICE_VERSION, PRIVACY_NOTICE_VERSION, hasLaunchLegalDetails } = require('../config/legal');

const hashRefreshToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

const AVATAR_BUCKET = process.env.SUPABASE_AVATAR_BUCKET || 'avatars';
const getStorageErrorDetails = (error) => {
  const original = error?.originalError || error?.cause;
  return {
    name: error?.name,
    message: error?.message,
    status: error?.status,
    statusCode: error?.statusCode,
    originalMessage: original?.message,
    originalCode: original?.cause?.code || original?.code,
    originalCause: original?.cause?.message,
  };
};

exports.register = async (req, res, next) => {
  let client;
  try {
    const { email, phone, password, full_name, complex_id } = req.body;
    // NOTE: 'role' is intentionally NOT accepted from req.body.
    // Public registration always creates 'resident' users.
    // Admins can change roles via PATCH /admin/users/:id.
    
    if (!complex_id) {
      return next(new AppError('complex_id is required during registration', 400));
    }

    if (process.env.NODE_ENV === 'production' && !hasLaunchLegalDetails()) {
      return next(new AppError('Registration is temporarily unavailable until the legal notices and service-provider contact details are approved.', 503));
    }

    const password_hash = await bcrypt.hash(password, 12);

    client = await getClient();
    await client.query('BEGIN');
    const newUser = await client.query(
      `INSERT INTO users (email, phone, password_hash, full_name, role, complex_id) 
       VALUES ($1, $2, $3, $4, 'resident', $5) RETURNING id, email, full_name, role, complex_id`,
      [email, phone, password_hash, full_name, complex_id]
    );

    const userId = newUser.rows[0].id;
    await client.query(
      `INSERT INTO user_notice_acknowledgements (user_id, notice_type, notice_version)
       VALUES ($1, 'terms', $2), ($1, 'privacy', $3)`,
      [userId, TERMS_NOTICE_VERSION, PRIVACY_NOTICE_VERSION]
    );
    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: newUser.rows[0],
    });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch { /* Preserve the original failure. */ }
    }
    if (err.code === '23505') return next(new AppError('User with this email or phone already exists', 400));
    next(err);
  } finally {
    client?.release();
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { rows } = await query(
      `SELECT u.*, c.name AS complex_name
       FROM users u
       LEFT JOIN complexes c ON u.complex_id = c.id
       WHERE u.email = $1 AND u.is_active = true`,
      [email]
    );
    if (rows.length === 0) {
      return next(new AppError('Invalid email or password', 401));
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return next(new AppError('Invalid email or password', 401));
    }

    // Fetch user units
    const unitsRes = await query(
      `SELECT u.id as unit_id, u.unit_number, uu.relation 
       FROM user_units uu 
       JOIN units u ON uu.unit_id = u.id 
       WHERE uu.user_id = $1`,
      [user.id]
    );

    const accessToken = signAccessToken(user);
    const refreshSessionId = crypto.randomUUID();
    const refreshToken = signRefreshToken(user, refreshSessionId);
    const decodedRefresh = verifyRefreshToken(refreshToken);
    await query(
      `INSERT INTO auth_refresh_sessions (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, to_timestamp($4))`,
      [refreshSessionId, user.id, hashRefreshToken(refreshToken), decodedRefresh.exp]
    );
    res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());

    res.status(200).json({
      success: true,
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        complex_id: user.complex_id,
        complex_name: user.complex_name || null,
        units: unitsRes.rows,
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.refresh = async (req, res, next) => {
  let client;
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return next(new AppError('Refresh token required', 400));

    const decoded = verifyRefreshToken(token);
    if (!decoded?.jti) return next(new AppError('Invalid or expired refresh token', 401));

    client = await getClient();
    await client.query('BEGIN');
    const session = await client.query(
      `SELECT id FROM auth_refresh_sessions
       WHERE id = $1 AND user_id = $2 AND token_hash = $3
         AND revoked_at IS NULL AND expires_at > now()
       FOR UPDATE`,
      [decoded.jti, decoded.id, hashRefreshToken(token)]
    );
    if (!session.rows.length) {
      await client.query('ROLLBACK');
      return next(new AppError('Invalid, expired, or revoked refresh token', 401));
    }

    const userResult = await client.query(
      'SELECT id, role, is_active, complex_id, email, full_name FROM users WHERE id = $1',
      [decoded.id]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
      await client.query('UPDATE auth_refresh_sessions SET revoked_at = now() WHERE id = $1', [decoded.jti]);
      await client.query('COMMIT');
      return next(new AppError('User not found or deactivated', 401));
    }

    const user = userResult.rows[0];
    const nextSessionId = crypto.randomUUID();
    const nextRefreshToken = signRefreshToken(user, nextSessionId);
    const nextDecoded = verifyRefreshToken(nextRefreshToken);
    await client.query(
      'UPDATE auth_refresh_sessions SET revoked_at = now(), replaced_by = $1 WHERE id = $2',
      [nextSessionId, decoded.jti]
    );
    await client.query(
      `INSERT INTO auth_refresh_sessions (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, to_timestamp($4))`,
      [nextSessionId, user.id, hashRefreshToken(nextRefreshToken), nextDecoded.exp]
    );
    await client.query('COMMIT');
    const newAccessToken = signAccessToken(user);
    res.cookie('refreshToken', nextRefreshToken, getRefreshCookieOptions());
    res.status(200).json({
      success: true,
      accessToken: newAccessToken
    });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch { /* Preserve the original failure. */ }
    }
    next(err);
  } finally {
    client?.release();
  }
};

exports.logout = async (req, res, next) => {
  const token = req.cookies?.refreshToken;
  res.clearCookie('refreshToken', getRefreshCookieOptions());
  const decoded = token ? verifyRefreshToken(token) : null;
  if (decoded?.jti) {
    try {
      await query('UPDATE auth_refresh_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [decoded.jti]);
    } catch (error) {
      return next(error);
    }
  }
  res.status(200).json({ success: true });
};

exports.getMe = async (req, res, next) => {
  try {
    // Single query to get user + active unit context (building + complex)
    const { rows } = await query(
      `SELECT
        u.id, u.email, u.phone, u.full_name, u.role, u.avatar_url, u.complex_id, u.created_at,
        u.emergency_contact,
        c.id AS ctx_complex_id, c.name AS complex_name,
        b.id AS building_id, b.name AS building_name,
        un.id AS unit_id, un.unit_number,
        uu.relation
       FROM users u
       LEFT JOIN complexes c ON u.complex_id = c.id
       LEFT JOIN user_units uu ON uu.user_id = u.id AND uu.moved_out_at IS NULL
       LEFT JOIN units un ON uu.unit_id = un.id
       LEFT JOIN buildings b ON un.building_id = b.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return next(new AppError('User not found', 404));
    }

    const row = rows[0];

    // Build structured response
    const userPayload = {
      id: row.id,
      email: row.email,
      phone: row.phone,
      full_name: row.full_name,
      role: row.role,
      avatar_url: row.avatar_url,
      complex_id: row.complex_id,
      complex_name: row.complex_name || null,
      emergency_contact: row.emergency_contact || null,
      created_at: row.created_at,
      // Backward-compat flat fields
      unit: row.unit_number || null,
      units: row.unit_id ? [{ unit_id: row.unit_id, unit_number: row.unit_number, relation: row.relation }] : [],
    };

    // Structured context objects
    const complex = row.complex_id
      ? { id: row.complex_id, name: row.complex_name }
      : (row.ctx_complex_id ? { id: row.ctx_complex_id, name: row.complex_name } : null);

    const building = row.building_id
      ? { id: row.building_id, name: row.building_name }
      : null;

    const unit = row.unit_id
      ? { id: row.unit_id, unit_number: row.unit_number }
      : null;

    // Role-specific extra context
    let roleContext = null;

    if (row.role === 'vendor') {
      // Fetch vendor category and assigned society
      const vendorRes = await query(
        `SELECT vr.category, COUNT(vr.id) AS total_jobs
         FROM vendor_requests vr
         WHERE vr.assigned_vendor_id = $1
         GROUP BY vr.category
         LIMIT 1`,
        [row.id]
      );
      roleContext = {
        category: vendorRes.rows[0]?.category || null,
        total_jobs: parseInt(vendorRes.rows[0]?.total_jobs || 0),
      };
    }

    if (row.role === 'security') {
      roleContext = {
        duty: 'Security Guard',
        shift: 'General',
      };
    }

    // Parking slot for residents
    let parking = null;
    if (row.role === 'resident' && row.unit_id) {
      const parkingRes = await query(
        `SELECT ps.slot_number, ps.type
         FROM parking_assignments pa
         JOIN parking_slots ps ON pa.slot_id = ps.id
         WHERE pa.unit_id = $1 AND (pa.assigned_until IS NULL OR pa.assigned_until > now())
         LIMIT 1`,
        [row.unit_id]
      );
      parking = parkingRes.rows[0] || null;
    }

    res.status(200).json({
      success: true,
      data: userPayload,
      complex,
      building,
      unit,
      parking,
      roleContext,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('Please upload an image file', 400));
    }

    const { id } = req.user;
    const file = req.file;
    if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
      logger.warn('Avatar upload missing file buffer', { requestId: req.id, field: file.fieldname });
      return next(new AppError('Uploaded avatar file was not readable', 400));
    }

    logger.info('Avatar upload received', {
      requestId: req.id,
      field: file.fieldname,
      mimetype: file.mimetype,
      size: file.size,
      bucket: AVATAR_BUCKET,
    });

    // First check if user already has an avatar
    const { rows: userRows } = await query('SELECT avatar_url FROM users WHERE id = $1', [id]);
    const oldAvatarUrl = userRows.length > 0 ? userRows[0].avatar_url : null;

    if (oldAvatarUrl) {
      // Extract file path from URL to delete it
      // Supabase public URL format: https://[project].supabase.co/storage/v1/object/public/avatars/[filepath]
      try {
        const urlParts = oldAvatarUrl.split('/public/avatars/');
        if (urlParts.length > 1) {
          const oldFilePath = urlParts[1];
          await supabase.storage.from(AVATAR_BUCKET).remove([oldFilePath]);
          logger.info('Old avatar removed', { requestId: req.id });
        }
      } catch (err) {
        // If deletion fails, log it but don't stop the new upload
        logger.warn('Failed to delete old avatar', { requestId: req.id, errorName: err.name, errorCode: err.code });
      }
    }

    // Generate unique filename inside the avatars bucket
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    const filePath = `${id}/${timestamp}-${safeName}`;

    // Upload to Supabase Storage
    let uploadError;
    try {
      ({ error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: true
        }));
    } catch (err) {
      logger.error('Supabase avatar upload threw', {
        requestId: req.id,
        bucket: AVATAR_BUCKET,
        errorName: err.name,
        code: err.cause?.code,
      });
      return next(new AppError('Error uploading avatar: could not reach Supabase Storage', 502));
    }

    if (uploadError) {
      const storageError = getStorageErrorDetails(uploadError);
      logger.error('Supabase avatar upload failed', {
        requestId: req.id,
        bucket: AVATAR_BUCKET,
        errorName: storageError.name,
        errorCode: storageError.originalCode || storageError.statusCode || storageError.status,
      });
      if (storageError.originalCode === 'CERT_NOT_YET_VALID') {
        return next(new AppError('Error uploading avatar: server clock is behind Supabase TLS certificate validity. Sync system date/time and retry.', 502));
      }
      return next(new AppError('Error uploading avatar. Please retry later.', 500));
    }
    logger.info('Supabase avatar upload succeeded', { requestId: req.id, bucket: AVATAR_BUCKET });

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(filePath);

    const avatarUrl = publicUrlData.publicUrl;
    if (!avatarUrl) {
      logger.error('Supabase public URL generation failed', { requestId: req.id, bucket: AVATAR_BUCKET });
      return next(new AppError('Avatar uploaded but public URL could not be generated', 500));
    }

    // Update database
    const { rows } = await query(
      'UPDATE users SET avatar_url = $1, updated_at = now() WHERE id = $2 RETURNING id, avatar_url',
      [avatarUrl, id]
    );

    res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (err) {
    next(err);
  }
};

exports.listComplexes = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT id, name FROM complexes ORDER BY name ASC');
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { full_name, phone, emergency_contact } = req.body;
    const { id } = req.user;

    if (!full_name && !phone && emergency_contact === undefined) {
      return next(new AppError('No fields to update', 400));
    }

    // Build dynamic update query
    const fields = [];
    const values = [];
    let idx = 1;

    if (full_name) { fields.push(`full_name = $${idx++}`); values.push(full_name.trim()); }
    if (phone) { fields.push(`phone = $${idx++}`); values.push(phone.trim()); }
    if (emergency_contact !== undefined) { fields.push(`emergency_contact = $${idx++}`); values.push(emergency_contact?.trim() || null); }

    fields.push(`updated_at = now()`);
    values.push(id);

    const { rows } = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, email, full_name, phone, emergency_contact, role, avatar_url`,
      values
    );

    if (rows.length === 0) return next(new AppError('User not found', 404));

    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return next(new AppError('Phone number already in use', 400));
    }
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  let client;
  try {
    const { current_password, new_password } = req.body;
    const { id } = req.user;

    client = await getClient();
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT password_hash FROM users WHERE id = $1 FOR UPDATE', [id]);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return next(new AppError('User not found', 404));
    }

    const isMatch = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!isMatch) {
      await client.query('ROLLBACK');
      return next(new AppError('Current password is incorrect', 401));
    }

    const newHash = await bcrypt.hash(new_password, 12);
    await client.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [newHash, id]);
    const currentSessionId = verifyRefreshToken(req.cookies?.refreshToken || '')?.jti;
    if (currentSessionId) {
      await client.query(
        `UPDATE auth_refresh_sessions SET revoked_at = now()
         WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`,
        [id, currentSessionId]
      );
    } else {
      await client.query(
        'UPDATE auth_refresh_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [id]
      );
    }
    await client.query('COMMIT');

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch { /* Preserve the original failure. */ }
    }
    next(err);
  } finally {
    client?.release();
  }
};
