import express from 'express';
import cors from 'cors';
import tripsRouter from './routes/trips.js';
import participantsRouter from './routes/participants.js';
import resultsRouter from './routes/results.js';
import meRouter from './routes/me.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/trips', tripsRouter);
  app.use('/api', participantsRouter);
  app.use('/api/trips', resultsRouter);
  app.use('/api/me', meRouter);

  app.use((req, res) => res.status(404).json({ error: 'not_found', path: req.path }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status ?? 500;
    if (status >= 500) console.error('[convoy] unhandled error:', err);
    res.status(status).json({
      error: err.code ?? 'internal_error',
      message: err.message,
      details: err.details,
    });
  });

  return app;
}
