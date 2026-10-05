const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const TLS_ERROR_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);

const getTlsDiagnostic = (error) => {
  let current = error;
  let depth = 0;

  while (current && depth < 4) {
    const code = current.code || current.cause?.code;
    const message = typeof current.message === 'string' ? current.message : '';
    if (TLS_ERROR_CODES.has(code) || /certificate|tls handshake/i.test(message)) {
      return {
        tlsErrorCode: code || null,
        tlsErrorMessage: message.slice(0, 240),
      };
    }
    current = current.cause || current.originalError;
    depth += 1;
  }

  return {};
};

const redactDiagnosticText = (value, maxLength) => {
  if (typeof value !== 'string') return undefined;
  return value
    .replace(/\b(password|passwd|access[_-]?token|refresh[_-]?token|authorization|api[_-]?key|secret|service[_-]?role[_-]?key)\b(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1$2[REDACTED]')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_TOKEN]')
    .replace(/(postgres(?:ql)?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@')
    .slice(0, maxLength);
};

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  const requestPath = (req.originalUrl || `${req.baseUrl || ''}${req.route?.path || req.path}`).split('?')[0];

  if (err.isOperational && err.statusCode < 500) {
    if (err.statusCode === 400) {
      logger.warn('Request rejected', {
        requestId: req.id,
        statusCode: err.statusCode,
        errorName: err.name,
        path: requestPath,
      });
    }
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
    });
  }

  if (err.isOperational && err.statusCode === 503) {
    return res.status(503).json({
      success: false,
      status: err.status,
      message: err.message,
    });
  }

  const tlsDiagnostic = getTlsDiagnostic(err);
  const registrationDiagnostics = requestPath === '/api/v1/auth/register'
    ? {
      errorMessage: redactDiagnosticText(err.message, 1200),
      errorStack: redactDiagnosticText(err.stack, 6000),
    }
    : {};
  logger.error('Unhandled API error', {
    requestId: req.id,
    errorName: err.name,
    errorCode: err.code,
    ...registrationDiagnostics,
    path: requestPath,
    ...tlsDiagnostic,
  });

  const isNoticeEndpoint = /^\/(?:api\/v1\/)?(?:notices|notifications)(?:\/|$)/.test(requestPath);
  if (err.code === '42P01' && isNoticeEndpoint) {
    return res.status(503).json({
      success: false,
      status: 'error',
      message: 'Society notices are temporarily unavailable because the required database setup is incomplete.',
    });
  }

  const isLoginRequest = requestPath === '/api/v1/auth/login';
  return res.status(err.statusCode >= 500 ? err.statusCode : 500).json({
    success: false,
    status: 'error',
    message: isLoginRequest
      ? 'Sign in is temporarily unavailable. Please try again shortly.'
      : 'A server error occurred. Please try again shortly.',
  });
};

module.exports = {
  AppError,
  errorHandler,
  getTlsDiagnostic,
  redactDiagnosticText,
};
