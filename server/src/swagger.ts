import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CollabDocs API',
      version: '1.0.0',
      description: 'Real-time collaborative document editor API with Y.js CRDT, WebSocket sync, and AI assistance',
      contact: {
        name: 'CollabDocs',
        url: 'https://collabdocs.vercel.app',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development server',
      },
      {
        url: 'https://your-backend.onrender.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Access token (JWT) — required for protected endpoints',
        },
        refreshToken: {
          type: 'apiKey',
          in: 'cookie',
          name: 'refreshToken',
          description: 'Refresh token stored in HttpOnly cookie',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            displayName: { type: 'string' },
            avatarUrl: { type: 'string', nullable: true },
            emailVerified: { type: 'boolean' },
          },
          required: ['id', 'email', 'displayName'],
        },
        Document: {
          type: 'object',
          properties: {
            _id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            ownerId: { type: 'string', format: 'uuid' },
            collaborators: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  permission: { enum: ['view', 'edit', 'comment'] },
                },
              },
            },
            shareLink: { type: 'string', nullable: true },
            shareLinkPermission: { enum: ['view', 'edit', null] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            deletedAt: { type: 'string', format: 'date-time', nullable: true },
          },
          required: ['_id', 'title', 'ownerId'],
        },
        Comment: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            documentId: { type: 'string' },
            authorId: { type: 'string' },
            anchorText: { type: 'string', description: 'The text selection being commented on' },
            body: { type: 'string' },
            resolved: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
          required: ['error'],
        },
      },
      responses: {
        Unauthorized: {
          description: 'Missing or invalid authentication token',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'Unauthorized' },
            },
          },
        },
        Forbidden: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'Access denied' },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'Document not found' },
            },
          },
        },
        RateLimited: {
          description: 'Too many requests',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'Too many requests, please try again later' },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    path.join(__dirname, 'routes', '*.ts'),
    path.join(__dirname, 'index.ts'),
  ],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
