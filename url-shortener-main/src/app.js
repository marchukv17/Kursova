import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createLinkService } from './service/link.service.js';
import { createItemService } from './service/item.service.js';

import { requestId } from './infra/requestId.js';
import { createRateLimit } from './infra/rateLimit.js';
import { createChaos } from './infra/chaos.js';
import { errorHandler, notFoundHandler } from './infra/errorHandler.js';

import { createHealthRouter } from './api/health.routes.js';
import { createItemsRouter } from './api/items.routes.js';
import { createLinksRouter } from './api/links.routes.js';
import { createRedirectHandler } from './api/redirect.routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');
const DOCS_DIR = join(__dirname, '..', 'docs');

export function createApp({ db, config = {} }) {
  const app = express();
  const linkService = createLinkService(db, { baseUrl: config.baseUrl });
  const itemService = createItemService(db);
  const idemStore = new Map();

  const apiRateLimit = createRateLimit({
    windowMs: Number(config.rateWindowMs || 10_000),
    max: Number(config.rateMax || 30),
  });
  const chaos = createChaos();

  app.disable('x-powered-by');
  app.use(requestId);
  app.use(cors());
  app.use(express.json({ limit: '32kb' }));

  app.use(express.static(PUBLIC_DIR));
  app.use('/docs', express.static(DOCS_DIR));

  app.use('/health', createHealthRouter());
  app.use('/items', apiRateLimit, createItemsRouter({ itemService }));
  app.use('/links', apiRateLimit, chaos, createLinksRouter({ linkService, idemStore }));

  app.get('/:slug', createRedirectHandler({ linkService }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
