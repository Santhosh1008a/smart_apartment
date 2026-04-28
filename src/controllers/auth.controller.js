const bcrypt = require('bcrypt');
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

    res.status(200).json({
      success: true,
      data: userPayload,
      complex,
      building,
      unit,
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
