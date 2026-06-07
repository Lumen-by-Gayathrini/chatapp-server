import type { Request, Response } from "express";
import * as authService from "./auth.service";

export async function register(req: Request, res: Response) {
  const result = await authService.register(req.body);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const result = await authService.login(req.body);
  res.status(200).json(result);
}

export async function refresh(req: Request, res: Response) {
  const result = await authService.refresh(req.body);
  res.status(200).json(result);
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.body);
  res.status(204).end();
}

export async function adminLogin(req: Request, res: Response) {
  const result = await authService.adminLogin(req.body);
  res.status(200).json(result);
}
