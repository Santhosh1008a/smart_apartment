const bcrypt = require('bcrypt');
const { query } = require('../config/db');
const supabase = require('../config/supabase');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { AppError } = require('../middlewares/error.middleware');

exports.register = async (req, res, next) => {
  try {
    const { email, phone, password, full_name } = req.body;
    // NOTE: 'role' is intentionally NOT accepted from req.body.
    // Public registration always creates 'resident' users.
    // Admins can change roles via PATCH /admin/users/:id.

    // Check if user exists
    const userCheck = await query('SELECT id FROM users WHERE email = $1 OR phone = $2', [email, phone]);
    if (userCheck.rows.length > 0) {
      return next(new AppError('User with this email or phone already exists', 400));
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = await query(
      `INSERT INTO users (email, phone, password_hash, full_name, role) 
       VALUES ($1, $2, $3, $4, 'resident') RETURNING id, email, full_name, role`,
      [email, phone, password_hash, full_name]
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

    const { rows } = await query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email]);
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

    const { rows } = await query('SELECT id, role, email, full_name FROM users WHERE id = $1', [decoded.id]);
    if (rows.length === 0) return next(new AppError('User not found', 404));

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
    const { rows } = await query(
      'SELECT id, email, phone, full_name, role, avatar_url, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (rows.length === 0) {
      return next(new AppError('User not found', 404));
    }

    const userPayload = rows[0];

    // Fetch user units
    const unitsRes = await query(
      `SELECT u.id as unit_id, u.unit_number, uu.relation 
       FROM user_units uu 
       JOIN units u ON uu.unit_id = u.id 
       WHERE uu.user_id = $1`,
      [req.user.id]
    );
    userPayload.units = unitsRes.rows;
    userPayload.unit = unitsRes.rows.length > 0 ? unitsRes.rows[0].unit_number : null; // For MainLayout compatibility

    res.status(200).json({
      success: true,
      data: userPayload,
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
