import type { Request, Response } from "express";
import * as syncService from "./sync.service";

export async function sync(req: Request, res: Response) {
  const result = await syncService.getSync(req.userId!, req.query.since as string | undefined);
  res.status(200).json(result);
}
