import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { loggerMiddleware } from './middleware/logger.middleware';
import { apiRateLimitMiddleware } from './middleware/rate-limit.middleware';
import { errorHandler } from './middleware/error.middleware';
import { authRoutes } from './routes/auth.route';
import { usersRoutes } from './routes/users.route';
import { assetsRoutes } from './routes/assets.route';
import { vehiclesRoutes } from './routes/vehicles.route';
import { nfcTagsRoutes } from './routes/nfc-tags.route';
import { workPermitsRoutes } from './routes/work-permits.route';
import { tripsRoutes } from './routes/trips.route';
import { nfcEventsRoutes } from './routes/nfc-events.route';
import { assetInspectionsRoutes } from './routes/asset-inspections.route';
import { assetChangesRoutes } from './routes/asset-changes.route';
import { reportsRoutes } from './routes/reports.route';

export function createApp() {
  const app = new OpenAPIHono();

  // ----------------------------------------------------------------
  // Security headers — applied to all responses
  // ----------------------------------------------------------------
  app.use(
    secureHeaders({
      strictTransportSecurity: 'max-age=63072000; includeSubDomains; preload',
      xContentTypeOptions: 'nosniff',
      xFrameOptions: 'DENY',
      referrerPolicy: 'no-referrer',
    })
  );

  // ----------------------------------------------------------------
  // CORS — restrict to known origins in production
  // ----------------------------------------------------------------
  app.use(
    cors({
      origin: (origin) => {
        const allowedOrigins = (process.env['CORS_ORIGINS'] ?? 'http://localhost:5173')
          .split(',')
          .map((o) => o.trim());
        return allowedOrigins.includes(origin) ? origin : '';
      },
      credentials: true,
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // ----------------------------------------------------------------
  // Global middleware
  // ----------------------------------------------------------------
  app.use(loggerMiddleware);
  app.use(apiRateLimitMiddleware);

  // ----------------------------------------------------------------
  // Routes
  // ----------------------------------------------------------------
  app.route('/auth', authRoutes);
  app.route('/users', usersRoutes);
  app.route('/assets', assetsRoutes);
  app.route('/vehicles', vehiclesRoutes);
  app.route('/nfc-tags', nfcTagsRoutes);
  app.route('/work-permits', workPermitsRoutes);
  app.route('/trips', tripsRoutes);
  app.route('/nfc-events', nfcEventsRoutes);
  app.route('/asset-inspections', assetInspectionsRoutes);
  app.route('/asset-changes', assetChangesRoutes);
  app.route('/reports', reportsRoutes);

  // ----------------------------------------------------------------
  // OpenAPI documentation (available in non-production only)
  // ----------------------------------------------------------------
  if (process.env['NODE_ENV'] !== 'production') {
    app.doc('/openapi.json', {
      openapi: '3.0.0',
      info: { title: 'NEPCO FieldOps API', version: '1.0.0' },
    });
  }

  // ----------------------------------------------------------------
  // Health check
  // ----------------------------------------------------------------
  app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // ----------------------------------------------------------------
  // Global error handler
  // ----------------------------------------------------------------
  app.onError(errorHandler);

  return app;
}

export type AppType = ReturnType<typeof createApp>;
