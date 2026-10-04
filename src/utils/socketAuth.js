const { verifyAccessToken } = require('./jwt');
const { query } = require('../config/db');

async function authenticateSocket(socket, next) {
  const token = socket.handshake.auth?.token;
  const decoded = typeof token === 'string' ? verifyAccessToken(token) : null;
  if (!decoded?.id) return next(new Error('Authentication required'));

  try {
    const { rows } = await query(
      'SELECT id, role, is_active, complex_id FROM users WHERE id = $1',
      [decoded.id]
    );
    const user = rows[0];
    if (!user?.is_active) return next(new Error('Authentication required'));

    socket.data.user = {
      id: user.id,
      role: user.role,
      complex_id: user.complex_id,
    };
    return next();
  } catch {
    return next(new Error('Authentication unavailable'));
  }
}

function getAuthorizedSocketRooms(user) {
  if (!user?.id) return [];
  const rooms = [`user:${user.id}`];
  if (user.complex_id && ['admin', 'security'].includes(user.role)) {
    rooms.push(`complex:${user.complex_id}:staff`);
  }
  return rooms;
}

module.exports = { authenticateSocket, getAuthorizedSocketRooms };
