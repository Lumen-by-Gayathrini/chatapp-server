import type { Request, Response } from "express";
import * as messagesService from "./messages.service";

export async function list(req: Request, res: Response) {
  const page = await messagesService.listMessages(req.userId!, req.params.id, req.query as never);
  res.status(200).json(page);
}

export async function send(req: Request, res: Response) {
  const result = await messagesService.sendMessage(req.userId!, req.params.id, req.body);
  // 201 on a fresh send; 200 when a replayed clientId returns the existing message.
  res.status(result.created ? 201 : 200).json(result.message);
}
