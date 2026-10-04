const winston = require('winston');
const path = require('path');

const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  transports: process.env.NODE_ENV === 'production'
    ? [new winston.transports.Console()]
    : [new winston.transports.File({ filename: path.join(__dirname, '../../logs/audit.log') })],
});

module.exports = auditLogger;
