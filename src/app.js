const Sentry = require("@sentry/node");
require('dotenv').config();
require('./config/environment').assertProductionEnvironment();

// Initialize Sentry VERY Early
Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const addRequestId = (req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};

const logger = require('./utils/logger');
const { errorHandler } = require('./middlewares/error.middleware');
const { query } = require('./config/db');
const { authenticateSocket, getAuthorizedSocketRooms } = require('./utils/socketAuth');
const { verifyAccessToken } = require('./utils/jwt');
const { globalLimiter } = require('./middlewares/rateLimiter.middleware');
const { auditLog } = require('./middlewares/audit.middleware');
const { initRedis } = require('./config/redis');
const http = require('http');
const { Server } = require('socket.io');

// Initialize Redis Cache
initRedis();

const app = express();
const server = http.createServer(app);
const configuredCorsOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOrigins = configuredCorsOrigins.length
  ? [...new Set(configuredCorsOrigins)]
  : process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173'];

if (process.env.NODE_ENV === 'production' && corsOrigins.length === 0) {
  throw new Error('CORS_ORIGINS must contain the exact production frontend origin(s).');
}

const isAllowedOrigin = (origin, callback) => {
  if (!origin || corsOrigins.includes(origin)) return callback(null, true);
  return callback(new Error('Origin is not allowed by CORS'));
};

// Sentry request handler must be the first middleware on the app
Sentry.setupExpressErrorHandler(app);

// Trust proxy for rate limiting behind Render/AWS ELB
app.set('trust proxy', 1);

// Generate UUID for each request
app.use(addRequestId);

// Compression
app.use(compression());

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: corsOrigins,
    credentials: true
  }
});

io.use(authenticateSocket);

io.on('connection', (socket) => {
  for (const room of getAuthorizedSocketRooms(socket.data.user)) socket.join(room);
  logger.info('Authenticated WebSocket connected', { role: socket.data.user.role });

  // Drop long-lived connections when the bearer token expires. Clients can
  // reconnect after refreshing through the HttpOnly refresh-token cookie.
  const token = socket.handshake.auth?.token;
  const decoded = verifyAccessToken(token);
  const expiresIn = decoded?.exp ? decoded.exp * 1000 - Date.now() : 0;
  const expiryTimer = expiresIn > 0 ? setTimeout(() => socket.disconnect(true), expiresIn) : null;

  socket.on('disconnect', () => {
    if (expiryTimer) clearTimeout(expiryTimer);
  });
});

app.set('io', io); // Accessible in controllers via req.app.get('io')

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: isAllowedOrigin,
  credentials: true,
}));
app.use(globalLimiter);

// Custom Morgan Format with Request ID
morgan.token('id', req => req.id);
morgan.token('safe-url', req => req.path);
app.use(morgan(
  process.env.NODE_ENV === 'production' 
    ? ':id ":method :safe-url HTTP/:http-version" :status :response-time ms'
    : 'dev',
  { stream: logger.stream }
));

app.use(auditLog('API Action'));

// Webhooks (Must be before express.json() so it can read raw body)
const webhookRoutes = require('./routes/webhook.routes');
app.use('/api/v1/webhooks', webhookRoutes);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Keep API documentation off production by default.
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_API_DOCS === 'true') {
  const swaggerUi = require('swagger-ui-express');
  const swaggerSpec = require('./config/swagger');
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// Serve static uploaded files
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health Check
app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1 AS ok');
    // Note: If Redis is strictly required for liveness, we'd ping it here too
    res.status(200).json({ status: 'ok', message: 'SyncLiving API is healthy and connected to Database' });
  } catch (err) {
    logger.error('Healthcheck database ping failed', { errorName: err.name, errorCode: err.code });
    res.status(503).json({ status: 'error', message: 'Database connection unhealthy' });
  }
});

// Import Routes
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const visitorRoutes = require('./routes/visitor.routes');
const paymentRoutes = require('./routes/payment.routes');
const serviceRoutes = require('./routes/services.routes');
const securityRoutes = require('./routes/security.routes');
const vendorRoutes = require('./routes/vendor.routes');
const notificationRoutes = require('./routes/notification.routes');
const parkingRoutes = require('./routes/parking.routes');
const assistantRoutes = require('./routes/assistant.routes');
const privacyRoutes = require('./routes/privacy.routes');

// Mount Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
const superAdminRoutes = require('./routes/super-admin.routes');
app.use('/api/v1/super-admin', superAdminRoutes);
app.use('/api/v1/visitors', visitorRoutes);
app.use('/api/v1', paymentRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/security', securityRoutes);
app.use('/api/v1/vendor', vendorRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/parking', parkingRoutes);
app.use('/api/v1/assistant', assistantRoutes);
app.use('/api/v1/privacy', privacyRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  server.listen(PORT, () => {
    logger.info(`Server is running with WebSocket enabled on port ${PORT}`);

    // Jobs are opt-in: starting the API against a configured database should
    // not mutate data or send reminders unless an operator enables a scheduler.
    if (process.env.ENABLE_IN_PROCESS_SCHEDULER === 'true') {
      const { startDueReminderJob, startMonthlyInvoiceJob, startVisitorCleanupJob } = require('./jobs/cron');
      startDueReminderJob(io);
      startMonthlyInvoiceJob();
      startVisitorCleanupJob(io);
    } else {
      logger.warn('In-process scheduled jobs are disabled; configure a single scheduler or an external job runner.');
    }
  });
}

module.exports = { app, server };
