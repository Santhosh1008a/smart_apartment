const Sentry = require("@sentry/node");
require('dotenv').config();

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
const { globalLimiter } = require('./middlewares/rateLimiter.middleware');
const { auditLog } = require('./middlewares/audit.middleware');
const { initRedis } = require('./config/redis');
const http = require('http');
const { Server } = require('socket.io');

// Initialize Redis Cache
initRedis();

const app = express();
const server = http.createServer(app);

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
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
  }
});

io.on('connection', (socket) => {
  logger.info(`New client connected to WebSocket: ${socket.id}`);

  // Join user-specific room for targeted notifications
  socket.on('join_user_room', (userId) => {
    if (userId) {
      socket.join(`user:${userId}`);
      logger.info(`Socket ${socket.id} joined room user:${userId}`);
    }
  });

  // Join complex/society room for society-wide broadcasts (emergencies, etc.)
  socket.on('join_complex_room', (complexId) => {
    if (complexId) {
      socket.join(`complex:${complexId}`);
      logger.info(`Socket ${socket.id} joined room complex:${complexId}`);
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

app.set('io', io); // Accessible in controllers via req.app.get('io')

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(globalLimiter);

// Custom Morgan Format with Request ID
morgan.token('id', req => req.id);
app.use(morgan(
  process.env.NODE_ENV === 'production' 
    ? ':id :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'
    : 'dev',
  { stream: logger.stream }
));

app.use(auditLog('API Action'));

// Webhooks (Must be before express.json() so it can read raw body)
const webhookRoutes = require('./routes/webhook.routes');
app.use('/api/v1/webhooks', webhookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Swagger API Documentation
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Serve static uploaded files
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health Check
app.get('/health', async (req, res) => {
  try {
    const { query } = require('./config/db');
    await query('SELECT 1 AS ok');
    // Note: If Redis is strictly required for liveness, we'd ping it here too
    res.status(200).json({ status: 'ok', message: 'Smart Apartment API is healthy and connected to Database' });
  } catch (err) {
    logger.error('Healthcheck DB Ping Failed', err);
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

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(`[${req.id || 'NO-ID'}] ${err.stack || err.message}`);
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  server.listen(PORT, () => {
    logger.info(`Server is running with WebSocket enabled on port ${PORT}`);

    // Start scheduled jobs
    const { startDueReminderJob, startMonthlyInvoiceJob } = require('./jobs/cron');
    startDueReminderJob(io);
    startMonthlyInvoiceJob();
  });
}

module.exports = { app, server };
