import "express";

/**
 * Request augmentations populated by middleware:
 *  - `id`      — per-request id (request-id middleware)
 *  - `userId`  — authenticated participant id (`requireAuth`)
 *  - `adminId` — authenticated researcher id (`requireAdmin`)
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      userId?: string;
      adminId?: string;
    }
  }
}

export {};
