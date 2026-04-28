const { query } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');
const bcrypt = require('bcrypt');

// GET /super-admin/dashboard — Platform-wide stats
exports.getDashboard = async (req, res, next) => {
  try {
    const [complexesRes, usersRes, complexListRes] = await Promise.all([
      query('SELECT COUNT(*) FROM complexes'),
      query('SELECT COUNT(*) FROM users'),
      query(`
        SELECT c.id, c.name, c.address, c.created_at,
               COUNT(u.id) FILTER (WHERE u.role != 'super_admin') AS total_users,
               COALESCE(
                 json_agg(
                   json_build_object('full_name', u.full_name, 'email', u.email)
                 ) FILTER (WHERE u.role = 'admin'),
                 '[]'
               ) AS admins
        FROM complexes c
        LEFT JOIN users u ON u.complex_id = c.id
        GROUP BY c.id
        ORDER BY c.name ASC
      `),
    ]);

    res.status(200).json({
      success: true,
      data: {
        total_complexes: parseInt(complexesRes.rows[0].count),
        total_users: parseInt(usersRes.rows[0].count),
        complexes: complexListRes.rows.map(r => ({
          id: r.id,
          name: r.name,
          address: r.address,
          total_users: parseInt(r.total_users),
          admins: r.admins,
          created_at: r.created_at,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /super-admin/complexes — Create a new society
exports.createComplex = async (req, res, next) => {
  try {
    const { name, address } = req.body;
    const { rows } = await query(
      'INSERT INTO complexes (name, address) VALUES ($1, $2) RETURNING *',
      [name, address]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// POST /super-admin/admins — Create an admin user for a complex
exports.createAdmin = async (req, res, next) => {
  try {
    const { email, phone, password, full_name, complex_id } = req.body;

    if (!complex_id) {
      return next(new AppError('complex_id is required', 400));
    }

    // Verify complex exists
    const complexCheck = await query('SELECT id FROM complexes WHERE id = $1', [complex_id]);
    if (complexCheck.rows.length === 0) {
      return next(new AppError('Complex not found', 404));
    }

    const userCheck = await query('SELECT id FROM users WHERE email = $1 OR phone = $2', [email, phone]);
    if (userCheck.rows.length > 0) {
      return next(new AppError('User with this email or phone already exists', 400));
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const { rows } = await query(
      `INSERT INTO users (email, phone, password_hash, full_name, role, complex_id) 
       VALUES ($1, $2, $3, $4, 'admin', $5) RETURNING id, email, full_name, role, complex_id`,
      [email, phone, password_hash, full_name, complex_id]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};
