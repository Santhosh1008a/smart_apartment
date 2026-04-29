const bcrypt = require('bcrypt');
const Joi = require('joi');
const { query } = require('../config/db');
const supabase = require('../config/supabase');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { AppError } = require('../middlewares/error.middleware');

exports.register = async (req, res, next) => {
  try {
    const { email, phone, password, full_name, complex_id } = req.body;
    // NOTE: 'role' is intentionally NOT accepted from req.body.
    // Public registration always creates 'resident' users.
    // Admins can change roles via PATCH /admin/users/:id.
    
    if (!complex_id) {
      return next(new AppError('complex_id is required during registration', 400));
    }

    // Check if user exists
    const userCheck = await query('SELECT id FROM users WHERE email = $1 OR phone = $2', [email, phone]);
    if (userCheck.rows.length > 0) {
      return next(new AppError('User with this email or phone already exists', 400));
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = await query(
      `INSERT INTO users (email, phone, password_hash, full_name, role, complex_id) 
       VALUES ($1, $2, $3, $4, 'resident', $5) RETURNING id, email, full_name, role, complex_id`,
      [email, phone, password_hash, full_name, complex_id]
    );

    res.status(201).json({
      success: true,
      data: newUser.rows[0],
    });
  } catch (err) {
    next(err);
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

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    // Set refresh token in httpOnly cookie protecting against XSS
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Fetch user units
    const unitsRes = await query(
      `SELECT u.id as unit_id, u.unit_number, uu.relation 
       FROM user_units uu 
       JOIN units u ON uu.unit_id = u.id 
       WHERE uu.user_id = $1`,
      [user.id]
    );

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
  try {
    const token = req.cookies.refreshToken || req.body.token; // Fallback for testing/swagger
    if (!token) return next(new AppError('Refresh token required', 400));

    const decoded = verifyRefreshToken(token);
    if (!decoded) return next(new AppError('Invalid or expired refresh token', 401));

    const { rows } = await query('SELECT id, role, is_active, complex_id, email, full_name FROM users WHERE id = $1', [decoded.id]);
    if (rows.length === 0 || !rows[0].is_active) return next(new AppError('User not found', 404));

    const user = rows[0];
    const newAccessToken = signAccessToken(user);

    res.status(200).json({
      success: true,
      accessToken: newAccessToken
    });
  } catch (err) {
    next(err);
  }
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
          await supabase.storage.from('avatars').remove([oldFilePath]);
        }
      } catch (err) {
        // If deletion fails, log it but don't stop the new upload
        const logger = require('../utils/logger');
        logger.warn(`Failed to delete old avatar for user ${id}: ${err.message}`);
      }
    }

    // Generate unique filename: avatars/{userId}-{timestamp}
    const timestamp = Date.now();
    const filename = `${id}-${timestamp}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const filePath = `avatars/${filename}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (uploadError) {
      return next(new AppError(`Error uploading to Supabase: ${uploadError.message}`, 500));
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const avatarUrl = publicUrlData.publicUrl;

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
  try {
    const { current_password, new_password } = req.body;
    const { id } = req.user;

    if (!current_password || !new_password) {
      return next(new AppError('current_password and new_password are required', 400));
    }

    if (new_password.length < 6) {
      return next(new AppError('New password must be at least 6 characters', 400));
    }

    // Fetch current password hash
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [id]);
    if (rows.length === 0) return next(new AppError('User not found', 404));

    const isMatch = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!isMatch) return next(new AppError('Current password is incorrect', 401));

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(new_password, salt);

    await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [newHash, id]);

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};
