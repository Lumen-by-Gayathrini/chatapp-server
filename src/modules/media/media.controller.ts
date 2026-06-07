import type { Request, Response } from "express";
import { AppError } from "../../lib/errors";
import * as mediaService from "./media.service";

export async function upload(req: Request, res: Response) {
  if (!req.file) throw AppError.validation("A file is required");
  const result = await mediaService.uploadMedia(req.userId!, req.file);
  res.status(201).json(result);
}
