import type { Request, Response } from "express";
import * as conversationsService from "./conversations.service";

export async function list(req: Request, res: Response) {
  const conversations = await conversationsService.listConversations(req.userId!);
  res.status(200).json(conversations);
}

export async function create(req: Request, res: Response) {
  const result = await conversationsService.createConversation(req.userId!, req.body.peerUserId);
  // Idempotent: 200 when an existing 1:1 conversation is returned, 201 when created.
  res.status(result.created ? 201 : 200).json(result.conversation);
}

export async function remove(req: Request, res: Response) {
  await conversationsService.deleteConversation(req.userId!, req.params.id);
  res.status(204).end();
}

export async function read(req: Request, res: Response) {
  await conversationsService.markRead(req.userId!, req.params.id, req.body.upTo);
  res.status(204).end();
}
