import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";

/**
 * Local development entry. Vercel uses `api/index.ts` instead (the Express app is a
 * valid serverless handler). The DB connection is established lazily per request via
 * the cached-connection middleware, so the server boots even without a database.
 */
const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`ChatApp server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
