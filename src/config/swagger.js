const swaggerJSDoc = require('swagger-jsdoc');
require('dotenv').config();

const apiPublicUrl = (process.env.API_PUBLIC_URL || '').replace(/\/+$/, '');
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'SyncLiving API',
    version: '1.0.0',
    description: 'API documentation for the backend infrastructure mapping endpoints, schemas, and required authorizations.',
  },
  servers: [
    {
      url: `http://localhost:${process.env.PORT || 5000}/api/v1`,
      description: 'Development Server',
    },
    ...(apiPublicUrl ? [{ url: `${apiPublicUrl}/api/v1`, description: 'Configured API Server' }] : [])
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Use the `accessToken` returned from /api/v1/auth/login'
      },
    },
  },
  security: [{
    bearerAuth: []
  }],
};

const options = {
  swaggerDefinition,
  // Match all route files
  apis: ['./src/routes/*.js'], 
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
