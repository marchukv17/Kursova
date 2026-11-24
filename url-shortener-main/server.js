import { createDatabase } from './src/infra/db.js';
import { createApp } from './src/app.js';

const PORT = Number(process.env.PORT || 3000);
const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;

const db = createDatabase(process.env.DB_PATH || 'data/app.db');
const app = createApp({ db, config: { baseUrl } });

const server = app.listen(PORT, () => {
  console.log(`URL shortener running on ${baseUrl}`);
  console.log(`Health: ${baseUrl}/health`);
});

function shutdown() {
  server.close(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
