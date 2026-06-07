import { createApp } from "../src/app";

/**
 * Vercel serverless entry (TDD §4.2). An Express app is a valid `(req, res)` handler,
 * so we export the composed app directly. `vercel.json` rewrites `/api/(.*)` to this
 * single function.
 */
const app = createApp();

export default app;
