import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDb } from '../db/knex';
import { runMigrations } from '../db/migrate';
import { errorHandler } from './middleware/errorHandler';
import listsRouter from './routes/lists';
import tasksRouter from './routes/tasks';
import syncRouter from './routes/sync';
import importRouter from './routes/importRoute';
import smartListsRouter from './routes/smartLists';

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Body parser
app.use(express.json());

// Routes API version 1
app.use('/api/v1/lists', listsRouter);
app.use('/api/v1/tasks', tasksRouter);
app.use('/api/v1/sync', syncRouter);
app.use('/api/v1/import', importRouter);
app.use('/api/v1/smart-lists', smartListsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve web UI assets in production
const webBuildPath = path.resolve(process.cwd(), 'dist', 'web');
app.use(express.static(webBuildPath));

// Fallback all other routes to index.html for SPA router
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    next();
    return;
  }
  res.sendFile(path.join(webBuildPath, 'index.html'), (err) => {
    if (err) {
      // In development or if build is missing, index.html might not exist.
      res.status(404).send('Web UI assets not built. Run `npm run build` or use Vite dev server.');
    }
  });
});

// Error handling middleware
app.use(errorHandler);

// Bootstrap database and start server
async function bootstrap() {
  try {
    console.log('Initializing database...');
    initDb();

    console.log('Running database migrations...');
    await runMigrations();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📂 Web UI build path: ${webBuildPath}`);
    });
  } catch (err) {
    console.error('Fatal error during startup bootstrap:', err);
    process.exit(1);
  }
}

bootstrap();
