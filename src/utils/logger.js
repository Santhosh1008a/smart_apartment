const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    ({ timestamp, level, message, stack, ...metadata }) => {
      const isRegistrationFailure = message === 'Unhandled API error'
        && metadata.path === '/api/v1/auth/register';
      const errorDetails = isRegistrationFailure ? ` ${JSON.stringify(metadata)}` : '';
      return `${timestamp} ${level}: ${stack || message}${errorDetails}`;
    }
  )
);

const transports = process.env.NODE_ENV === 'production'
  ? [new winston.transports.Console({ format: logFormat })]
  : [
      new winston.transports.File({ filename: path.join(__dirname, '../../logs/error.log'), level: 'error' }),
      new winston.transports.File({ filename: path.join(__dirname, '../../logs/combined.log') }),
      new winston.transports.Console({ format: consoleFormat }),
    ];

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: logFormat,
  defaultMeta: { service: 'tdpcl-api' },
  transports,
});

// create a stream object with a 'write' function that will be used by morgan
logger.stream = {
  write: function (message) {
    // use the 'info' log level so the output will be picked up by both transports
    logger.info(message.trim());
  },
};

module.exports = logger;
