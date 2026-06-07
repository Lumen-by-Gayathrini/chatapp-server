import type { Request, Response } from "express";
import * as profileService from "./profile.service";

export async function getMe(req: Request, res: Response) {
  const user = await profileService.getMe(req.userId!);
  res.status(200).json(user);
}

export async function updateMe(req: Request, res: Response) {
  const user = await profileService.updateMe(req.userId!, req.body);
  res.status(200).json(user);
}
