const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;

// Used for general endpoints
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per `window`
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' }
});

// Stricter limiter for authentication attempts
const AUTH_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_LIMIT_MAX = 10;
const createAuthLimiter = () => rateLimit({
  windowMs: AUTH_LIMIT_WINDOW_MS,
  max: AUTH_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later' }
});
const authLimiter = createAuthLimiter();

// Limiter for payments
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many payment requests, please try again later' }
});

// Stricter limiter for AI assistant prompts
const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
  message: { success: false, message: 'Too many assistant requests, please try again shortly' }
});

module.exports = {
  globalLimiter,
  authLimiter,
  createAuthLimiter,
  AUTH_LIMIT_WINDOW_MS,
  AUTH_LIMIT_MAX,
  paymentLimiter,
  aiLimiter
};
